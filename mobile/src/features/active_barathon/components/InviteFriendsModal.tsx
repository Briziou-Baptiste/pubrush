import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: () => void;
  joinCode: string;
  barathonName: string;
  participantsCount?: number;
};

export default function InviteFriendsModal({
  visible,
  onClose,
  joinCode,
  barathonName,
  participantsCount,
}: Props) {
  const [imageLoading, setImageLoading] = useState(true);

  const cleanCode = joinCode || 'RUSH-CODE';
  const joinUrl = `https://pubrush.com/join/${cleanCode}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(
    joinUrl
  )}`;

  async function handleShare() {
    try {
      await Share.share({
        message: `Rejoins notre barathon "${barathonName}" sur PubRush en 1 seconde sans créer de compte !\n\nLien direct : ${joinUrl}\nCode : ${cleanCode}`,
        url: joinUrl,
        title: `Invitation PubRush : ${barathonName}`,
      });
    } catch {
      Alert.alert('Partage', 'Impossible d’ouvrir le menu de partage.');
    }
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
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="qr-code-outline" size={20} color="#2563EB" />
                <Text style={styles.title}>Inviter des amis</Text>
              </View>
              <Text style={styles.subtitle}>
                Rejoindre en 1 seconde sans créer de compte !
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            {imageLoading && (
              <View style={styles.qrLoader}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            )}
            <Image
              source={{ uri: qrApiUrl }}
              style={styles.qrImage}
              contentFit="contain"
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
            />
          </View>

          {/* Join Code Display */}
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>CODE DE REJOINTEMENT</Text>
            <Text style={styles.codeValue}>{cleanCode}</Text>
          </View>

          {/* Live participant hint */}
          {typeof participantsCount === 'number' && (
            <View style={styles.participantsBadge}>
              <Ionicons name="people" size={16} color="#2563EB" />
              <Text style={styles.participantsBadgeText}>
                {participantsCount} participant{participantsCount > 1 ? 's' : ''} dans le barathon
              </Text>
            </View>
          )}

          {/* Share Action */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Partager le lien (WhatsApp, SMS...)</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            <Ionicons name="phone-portrait-outline" size={14} color="#64748B" />
            <Text style={[styles.footerNote, { marginTop: 0 }]}>
              Vos amis accèdent directement à une page Web mobile avec la carte, le chrono et leur rôle !
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  closeButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  qrContainer: {
    width: 220,
    height: 220,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  qrLoader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  codeCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E40AF',
    letterSpacing: 2,
    marginTop: 2,
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 16,
  },
  participantsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    height: 50,
    width: '100%',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
  },
});
