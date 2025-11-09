import { StyleSheet, View, Text, Pressable, ScrollView, Alert, Image, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SvgXml } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';

const settingsIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Load user data (interests and profile photo)
  const loadUserData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get Google profile photo if available
      if (user.photoURL) {
        setProfilePhoto(user.photoURL);
      }

      // Load from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.interests) {
          setInterests(data.interests);
        }
        if (data.profilePhoto) {
          setProfilePhoto(data.profilePhoto);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load on mount
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleEditInterests = () => {
    router.push('/edit-interests');
  };

  const handleChangeProfilePhoto = async () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        {
          text: 'Choose from Library',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && user) {
              const photoUri = result.assets[0].uri;
              setProfilePhoto(photoUri);
              
              // Save to Firestore
              try {
                await setDoc(
                  doc(db, 'users', user.uid),
                  { profilePhoto: photoUri },
                  { merge: true }
                );
              } catch (error) {
                console.error('Error saving profile photo:', error);
              }
            }
          },
        },
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && user) {
              const photoUri = result.assets[0].uri;
              setProfilePhoto(photoUri);
              
              // Save to Firestore
              try {
                await setDoc(
                  doc(db, 'users', user.uid),
                  { profilePhoto: photoUri },
                  { merge: true }
                );
              } catch (error) {
                console.error('Error saving profile photo:', error);
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>Personal Feed</Text>
          </View>
          <View style={styles.settingsIconContainer}>
            <Pressable style={styles.settingsButton}>
              <SvgXml xml={settingsIconSvg} width={24} height={24} />
            </Pressable>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileContent}>
            <Pressable style={styles.avatarContainer} onPress={handleChangeProfilePhoto}>
              <Image
                source={profilePhoto ? { uri: profilePhoto } : require('@/assets/images/profile-avatar.png')}
                style={styles.avatar}
                resizeMode="cover"
              />
              <View style={styles.avatarOverlay}>
                <Text style={styles.avatarOverlayText}>Change</Text>
              </View>
            </Pressable>
            <View style={styles.profileInfo}>
              <View style={styles.nameContainer}>
                <Text style={styles.name}>{user?.email?.split('@')[0] || 'Ethan Carter'}</Text>
              </View>
              <View style={styles.usernameContainer}>
                <Text style={styles.username}>@{user?.email?.split('@')[0] || 'ethan_carter'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Interests Section */}
        <View style={styles.interestsSection}>
          <Text style={styles.sectionTitle}>Interests</Text>
        </View>

        <View style={styles.interestsChipsContainer}>
          {(interests.length > 0 ? interests : ['AI', 'Poetry', 'Tech', 'Design', 'Philosophy']).map((interest, index) => (
            <View key={index} style={styles.interestChip}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>

        {/* Edit Interests Button */}
        <View style={styles.editButtonContainer}>
          <Pressable style={styles.editButton} onPress={handleEditInterests}>
            <Text style={styles.editButtonText}>Edit Interests</Text>
          </Pressable>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>

        {/* Notifications Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#243847', true: '#5C80FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Dark Mode Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>Dark Mode</Text>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: '#243847', true: '#5C80FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <Pressable
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121C21',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: 48,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 23,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  settingsIconContainer: {
    width: 48,
    alignItems: 'flex-end',
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  profileContent: {
    flexDirection: 'row',
    gap: 16,
  },
  avatarContainer: {
    width: 128,
    position: 'relative',
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    borderBottomLeftRadius: 64,
    borderBottomRightRadius: 64,
    alignItems: 'center',
  },
  avatarOverlayText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 12,
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameContainer: {
    height: 28,
  },
  name: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  usernameContainer: {
    width: 140,
  },
  username: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#94B2C7',
  },
  interestsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 23,
    color: '#FFFFFF',
  },
  interestsChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  interestChip: {
    backgroundColor: '#243847',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
  },
  interestText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  editButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editButton: {
    backgroundColor: '#243847',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  settingsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  toggleContainer: {
    paddingHorizontal: 16,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  toggleLabel: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  signOutContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  signOutButton: {
    backgroundColor: '#243847',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
