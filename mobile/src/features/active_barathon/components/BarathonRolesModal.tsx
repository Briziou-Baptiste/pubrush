import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AssignedBarathonRole } from '../../../lib/api';

type Props = {
  visible: boolean;
  onClose: () => void;
  roles: AssignedBarathonRole[];
  loading?: boolean;
  currentUserId?: number;
};

export default function BarathonRolesModal({
  visible,
  onClose,
  roles,
  loading = false,
  currentUserId,
}: Props) {
  function getRoleEmoji(roleName: string) {
    const lower = roleName.toLowerCase();
    if (lower.includes('compte')) return '💰';
    if (lower.includes('temps') || lower.includes('chrono')) return '⏱️';
    if (lower.includes('ambiance') || lower.includes('fête')) return '🎉';
    if (lower.includes('sam') || lower.includes('conducteur')) return '🚗';
    if (lower.includes('capitaine') || lower.includes('chef')) return '⭐';
    if (lower.includes('photo') || lower.includes('souvenir')) return '📸';
    return '👑';
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>👑 Qui est le maître de quoi ?</Text>
              <Text style={styles.subtitle}>
                Rappel des missions et pouvoirs de chacun
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Chargement des rôles...</Text>
            </View>
          ) : roles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={styles.emptyTitle}>Aucun rôle configuré</Text>
              <Text style={styles.emptySubtitle}>
                Ce barathon a été démarré sans attribution spécifique de rôles.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.rolesList} showsVerticalScrollIndicator={false}>
              {roles.map((item) => {
                const isMe = currentUserId !== undefined && item.user_id === currentUserId;
                const emoji = getRoleEmoji(item.role_name);

                return (
                  <View
                    key={`${item.user_id}-${item.role_id}`}
                    style={[styles.roleCard, isMe && styles.roleCardHighlight]}
                  >
                    <View style={styles.emojiBadge}>
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </View>

                    <View style={styles.roleContent}>
                      <View style={styles.roleHeaderRow}>
                        <Text style={styles.participantName}>{item.username}</Text>
                        {isMe && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>Vous</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.roleName}>{item.role_name}</Text>

                      {item.role_description ? (
                        <Text style={styles.roleDescription}>
                          {item.role_description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeButtonText}>Compris !</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  rolesList: {
    maxHeight: 340,
    marginVertical: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roleCardHighlight: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C4B5FD',
  },
  emojiBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 22,
  },
  roleContent: {
    flex: 1,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  youBadge: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D28D9',
    marginTop: 1,
  },
  roleDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 16,
  },
  closeButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
