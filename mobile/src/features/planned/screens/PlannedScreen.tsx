import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUserId } from '../../../lib/authStorage';
import BarathonCard from '../../barathon_past_planned/components/BarathonCard';
import { BarathonListItem } from '../../barathon_past_planned/types/barathon.types';
import { styles } from '../styles/planned.styles';
import ChangeStartTimeModal from '../components/ChangeStartTimeModal';
import ManageParticipantsModal from '../components/ManageParticipantsModal';
import { updateBarathonStartDatetime, deleteBarathon, getMyUpcomingBarathons } from '../services/planned.service';
import { parseApiDate } from '../../../lib/dateUtils';

export default function PlannedScreen() {
    const [barathons, setBarathons] = useState<BarathonListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [deletingBarathonId, setDeletingBarathonId] = useState<number | null>(null);
    const [selectedBarathon, setSelectedBarathon] = useState<BarathonListItem | null>(null);
    const [changeTimeModalVisible, setChangeTimeModalVisible] = useState(false);
    const [participantsModalVisible, setParticipantsModalVisible] = useState(false);
    const [updatingStartTime, setUpdatingStartTime] = useState(false);
    const [startingBarathonId] = useState<number | null>(null);
    useEffect(() => {
        loadCurrentUserId();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

  async function loadCurrentUserId() {
    try {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
    } catch (error) {
      console.log('Impossible de charger currentUserId', error);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const data = await getMyUpcomingBarathons();
      setBarathons(data);
    } catch (error) {
      Alert.alert(
        'Chargement impossible',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    } finally {
      setLoading(false);
    }
  }

    function handleAddParticipants(barathon: BarathonListItem) {
      setSelectedBarathon(barathon);
      setParticipantsModalVisible(true);
    }

    function handleDelete(barathon: BarathonListItem) {
      Alert.alert(
        'Supprimer le barathon',
        `Confirmer la suppression de "${barathon.name}" ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                setDeletingBarathonId(barathon.id);

                await deleteBarathon(barathon.id);

                setBarathons((prev) =>
                  prev.filter((item) => item.id !== barathon.id)
                );

                Alert.alert(
                  'Suppression réussie',
                  `"${barathon.name}" a bien été supprimé.`
                );
              } catch (error) {
                Alert.alert(
                  'Suppression impossible',
                  error instanceof Error ? error.message : 'Erreur inconnue'
                );
              } finally {
                setDeletingBarathonId(null);
              }
            },
          },
        ]
      );
    }
    function handleChangeStartTime(barathon: BarathonListItem) {
      setSelectedBarathon(barathon);
      setChangeTimeModalVisible(true);
    }

    async function handleConfirmChangeStartTime(newDate: Date) {
      if (!selectedBarathon) {
        return;
      }

      try {
        setUpdatingStartTime(true);

        const updated = await updateBarathonStartDatetime(
          selectedBarathon.id,
          newDate.toISOString()
        );

        setBarathons((prev) => {
          const updatedList = prev.map((item) =>
            item.id === selectedBarathon.id
              ? {
                  ...item,
                  ...updated,
                }
              : item
          );
          return updatedList.sort(
            (a, b) =>
              parseApiDate(a.start_datetime).getTime() -
              parseApiDate(b.start_datetime).getTime()
          );
        });

        setChangeTimeModalVisible(false);
        setSelectedBarathon(null);

        Alert.alert(
          'Modification réussie',
          "L'heure du barathon a bien été mise à jour."
        );
      } catch (error) {
        Alert.alert(
          'Modification impossible',
          error instanceof Error ? error.message : 'Erreur inconnue'
        );
      } finally {
        setUpdatingStartTime(false);
      }
    }
    
    function handleOpenInfo(barathon: BarathonListItem) {
      router.push({
        pathname: '/barathon-details',
        params: {
          barathonId: String(barathon.id),
        },
      });
    }
    
    function handleStartBarathon(barathon: BarathonListItem) {
      router.push({
        pathname: '/start-barathon-roles',
        params: {
          barathonId: String(barathon.id),
        },
      });
    }
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Barathons prévus</Text>
        <Text style={styles.subtitle}>
          Retrouve ici les barathons à venir.
        </Text>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            data={barathons}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={
              barathons.length === 0 ? styles.emptyListContent : styles.listContent
            }
             renderItem={({ item }) => (
                <BarathonCard
                  item={item}
                  variant="planned"
                  currentUserId={currentUserId ?? -1}
                  onChangeStartTime={handleChangeStartTime}
                  onAddParticipants={handleAddParticipants}
                  onDelete={handleDelete}
                  onInfo={handleOpenInfo}
                  onStart={handleStartBarathon}
                  isDeleting={deletingBarathonId === item.id || startingBarathonId === item.id}
                />
             )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>Aucun barathon prévu</Text>
                <Text style={styles.emptyStateText}>
                  Les prochains barathons apparaîtront ici.
                </Text>
              </View>
            }
          />
        )}
      </View>
      <ChangeStartTimeModal
        visible={changeTimeModalVisible}
        barathon={selectedBarathon}
        loading={updatingStartTime}
        onClose={() => {
          if (updatingStartTime) {
            return;
          }
          setChangeTimeModalVisible(false);
          setSelectedBarathon(null);
        }}
        onConfirm={handleConfirmChangeStartTime}
      />
      <ManageParticipantsModal
        visible={participantsModalVisible}
        barathon={selectedBarathon}
        currentUserId={currentUserId ?? -1}
        onClose={() => {
          setParticipantsModalVisible(false);
          setSelectedBarathon(null);
        }}
        onUpdated={(updatedBarathon) => {
          setBarathons((prev) =>
            prev.map((item) =>
              item.id === updatedBarathon.id
                ? {
                    ...item,
                    participants_count: updatedBarathon.participants.length,
                  }
                : item
            )
          );
        }}
      />
    </SafeAreaView>
  );
}
