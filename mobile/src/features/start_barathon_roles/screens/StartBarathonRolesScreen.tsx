import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  assignRolesAndStartBarathon,
  getBarathonStartConfig,
  startBarathonWithoutRoles,
} from '../services/startBarathonRoles.service';
import {
  ParticipantRoleAssignment,
  StartBarathonConfigResponse,
} from '../types/startBarathonRoles.types';
import { styles } from '../styles/startBarathonRoles.styles';
import ParticipantRoleCard from '../components/ParticipantRoleCard';

export default function StartBarathonRolesScreen() {
  const params = useLocalSearchParams<{ barathonId?: string }>();

  const [config, setConfig] = useState<StartBarathonConfigResponse | null>(null);
  const [assignments, setAssignments] = useState<ParticipantRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingWithRoles, setSubmittingWithRoles] = useState(false);
  const [submittingWithoutRoles, setSubmittingWithoutRoles] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, [params.barathonId]);

  async function loadConfig() {
    try {
      if (!params.barathonId) {
        throw new Error('Barathon introuvable.');
      }

      setLoading(true);

      const data = await getBarathonStartConfig(Number(params.barathonId));
      setConfig(data);

      setAssignments(
        data.participants.map((participant) => ({
          user_id: participant.user_id,
          role_id: null,
        }))
      );
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de charger la configuration.'
      );
    } finally {
      setLoading(false);
    }
  }

  const usedRoleIds = useMemo(() => {
    return assignments
      .map((assignment) => assignment.role_id)
      .filter((roleId): roleId is number => roleId !== null);
  }, [assignments]);

  const selectedRolesCount = usedRoleIds.length;
  const participantCount = config?.participants.length ?? 0;

  const canStartWithRoles =
    !!config &&
    selectedRolesCount === participantCount &&
    participantCount > 0 &&
    !submittingWithRoles &&
    !submittingWithoutRoles;

  function handleSelectRole(userId: number, roleId: number) {
    setAssignments((prev) =>
      prev.map((assignment) =>
        assignment.user_id === userId
          ? { ...assignment, role_id: roleId }
          : assignment
      )
    );
  }

  function handleRandomAssign() {
    if (!config) {
      return;
    }

    if (config.roles.length < config.participants.length) {
      Alert.alert(
        'Erreur',
        "Il n'y a pas assez de rôles disponibles pour tous les participants."
      );
      return;
    }

    const shuffledRoles = [...config.roles].sort(() => Math.random() - 0.5);
    const selectedRoles = shuffledRoles.slice(0, config.participants.length);

    const randomAssignments = config.participants.map((participant, index) => ({
      user_id: participant.user_id,
      role_id: selectedRoles[index].id,
    }));

    setAssignments(randomAssignments);
  }

  async function handleStartWithoutRoles() {
    try {
      if (!params.barathonId) {
        throw new Error('Barathon introuvable.');
      }

      setSubmittingWithoutRoles(true);

      await startBarathonWithoutRoles(Number(params.barathonId));

      router.replace({
        pathname: '/active-barathon',
        params: {
          barathonId: String(params.barathonId),
        },
      });
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de démarrer sans rôles.'
      );
    } finally {
      setSubmittingWithoutRoles(false);
    }
  }

  async function handleStartWithRoles() {
    try {
      if (!params.barathonId || !config) {
        throw new Error('Barathon introuvable.');
      }

      if (selectedRolesCount !== config.participants.length) {
        Alert.alert(
          'Erreur',
          `Il faut attribuer exactement ${config.participants.length} rôles.`
        );
        return;
      }

      const finalAssignments = assignments.filter(
        (assignment): assignment is { user_id: number; role_id: number } =>
          assignment.role_id !== null
      );

      setSubmittingWithRoles(true);

      await assignRolesAndStartBarathon(
        Number(params.barathonId),
        finalAssignments
      );

      router.replace({
        pathname: '/active-barathon',
        params: {
          barathonId: String(params.barathonId),
        },
      });
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de lancer le barathon avec rôles.'
      );
    } finally {
      setSubmittingWithRoles(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!config) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrapper}>
          <Text style={styles.emptyText}>Configuration introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.85}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

        <View style={styles.headerCard}>
          <Text style={styles.title}>Attribution des rôles</Text>
          <Text style={styles.subtitle}>{config.barathon_name}</Text>
          <Text style={styles.helperText}>
            Il faut attribuer exactement {config.participants.length} rôle(s).
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Participants</Text>
        <Text style={styles.roleCounter}>
          Rôles attribués : {selectedRolesCount} / {participantCount}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={handleRandomAssign}
          >
            <Text style={styles.secondaryButtonText}>Tirer au sort</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.neutralButton}
            activeOpacity={0.85}
            onPress={handleStartWithoutRoles}
            disabled={submittingWithoutRoles || submittingWithRoles}
          >
            <Text style={styles.neutralButtonText}>
              {submittingWithoutRoles ? 'Démarrage...' : 'Démarrer sans rôles'}
            </Text>
          </TouchableOpacity>
        </View>

        {config.participants.map((participant) => {
          const assignment = assignments.find(
            (item) => item.user_id === participant.user_id
          );

          return (
            <ParticipantRoleCard
              key={participant.user_id}
              participant={participant}
              roles={config.roles}
              assignment={assignment}
              usedRoleIds={usedRoleIds}
              onSelectRole={handleSelectRole}
            />
          );
        })}

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              !canStartWithRoles && styles.primaryButtonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleStartWithRoles}
            disabled={!canStartWithRoles}
          >
            <Text style={styles.primaryButtonText}>
              {submittingWithRoles
                ? 'Lancement...'
                : 'Lancer le barathon avec rôles'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
