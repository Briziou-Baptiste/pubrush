import { Text, TouchableOpacity, View } from 'react-native';

import {
  ParticipantRoleAssignment,
  StartConfigParticipant,
  StartConfigRole,
} from '../types/startBarathonRoles.types';
import { styles } from '../styles/startBarathonRoles.styles';

type Props = {
  participant: StartConfigParticipant;
  roles: StartConfigRole[];
  assignment: ParticipantRoleAssignment | undefined;
  usedRoleIds: number[];
  onSelectRole: (userId: number, roleId: number) => void;
};

export default function ParticipantRoleCard({
  participant,
  roles,
  assignment,
  usedRoleIds,
  onSelectRole,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.participantName}>{participant.username}</Text>
      <Text style={styles.participantEmail}>{participant.email}</Text>

      {assignment?.role_id ? (
        <View style={styles.selectedRoleBadge}>
          <Text style={styles.selectedRoleBadgeText}>
            Rôle sélectionné
          </Text>
        </View>
      ) : null}

      <View style={styles.rolesList}>
        {roles.map((role) => {
          const isSelected = assignment?.role_id === role.id;
          const isUsedByAnotherParticipant =
            usedRoleIds.includes(role.id) && !isSelected;

          return (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleButton,
                isSelected && styles.roleButtonSelected,
                isUsedByAnotherParticipant && { opacity: 0.4 },
              ]}
              activeOpacity={0.85}
              onPress={() => onSelectRole(participant.user_id, role.id)}
              disabled={isUsedByAnotherParticipant}
            >
              <Text
                style={[
                  styles.roleName,
                  isSelected && styles.roleNameSelected,
                ]}
              >
                {role.name}
              </Text>

              {role.description ? (
                <Text
                  style={[
                    styles.roleDescription,
                    isSelected && styles.roleDescriptionSelected,
                  ]}
                >
                  {role.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
