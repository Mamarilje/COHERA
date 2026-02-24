import { StyleSheet, TouchableOpacity, View, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '@/src/config/firebase';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { mockUser } from '@/data/mockData';

export default function ProfileScreen() {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      Alert.alert('Success', 'Signed out successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <ThemedText style={styles.avatar}>{mockUser.avatar}</ThemedText>
        </View>
        <ThemedText type="title" style={styles.name}>{mockUser.name}</ThemedText>
        <ThemedText style={styles.role}>Task Manager</ThemedText>
      </View>

      {/* Settings Options */}
      <View style={styles.settings}>
        <TouchableOpacity style={styles.settingItem}>
          <IconSymbol name="person.circle" size={24} color="#000000" />
          <ThemedText style={styles.settingText}>Edit Profile</ThemedText>
          <IconSymbol name="chevron.right" size={20} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <IconSymbol name="bell.circle" size={24} color="#000000" />
          <ThemedText style={styles.settingText}>Notifications</ThemedText>
          <IconSymbol name="chevron.right" size={20} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <IconSymbol name="lock.circle" size={24} color="#000000" />
          <ThemedText style={styles.settingText}>Privacy</ThemedText>
          <IconSymbol name="chevron.right" size={20} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <IconSymbol name="questionmark.circle" size={24} color="#000000" />
          <ThemedText style={styles.settingText}>Help & Support</ThemedText>
          <IconSymbol name="chevron.right" size={20} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
          <IconSymbol name="arrow.right.circle" size={24} color="#000000" />
          <ThemedText style={styles.settingText}>Sign Out</ThemedText>
          <IconSymbol name="chevron.right" size={20} color="#000000" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5C542',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: '#000000',
  },
  settings: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: '#000000',
  },
});
