//
//  AuthCard.tsx
//  
//
//  Created by Baptiste Briziou on 31/03/2026.
//

import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../styles/home.styles';

type HomeMenuProps = {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (path: '/planned' | '/past' | '/create-barathon' | '/profile') => void;
};

export default function HomeMenu({
  visible,
  onClose,
  onLogout,
  onNavigate,
}: HomeMenuProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.menuPanel}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>PubRush</Text>
            <Text style={styles.menuSubtitle}>Navigation</Text>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('/planned')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemTitle}>Barathons prévus</Text>
            <Text style={styles.menuItemSubtitle}>
              Retrouve tes tournées à venir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('/past')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemTitle}>Barathons passés</Text>
            <Text style={styles.menuItemSubtitle}>
              Consulte ton historique
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('/create-barathon')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemTitle}>Créer un barathon</Text>
            <Text style={styles.menuItemSubtitle}>
              Prépare une nouvelle tournée
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('/profile')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemTitle}>Infos personnelles</Text>
            <Text style={styles.menuItemSubtitle}>
              Gère ton profil
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
