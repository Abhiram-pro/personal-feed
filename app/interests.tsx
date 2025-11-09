import { StyleSheet, View, Text, Pressable, TextInput, ScrollView, Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

const INTERESTS = [
  'Technology',
  'Design',
  'Productivity',
  'Self-Improvement',
  'Business',
  'Startups',
  'Writing',
  'Marketing',
  'Psychology',
  'Philosophy',
  'History',
  'Science',
  'Art',
  'Culture',
  'Society',
];

const searchIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="#99A1BD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default function InterestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Prevent back navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Load existing interests from Firestore
  useEffect(() => {
    const loadInterests = async () => {
      if (!user) {
        setInitialLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.interests) {
            setSelectedInterests(data.interests);
          }
        }
      } catch (error) {
        console.error('Error loading interests:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInterests();
  }, [user]);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const filteredInterests = INTERESTS.filter((interest) =>
    interest.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinue = async () => {
    if (selectedInterests.length === 0) {
      Alert.alert('No interests selected', 'Please select at least one interest to continue.');
      return;
    }

    setLoading(true);
    try {
      // Save interests to Firestore
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            interests: selectedInterests,
            updatedAt: new Date().toISOString(),
            email: user.email,
          },
          { merge: true }
        );
      } else {
        // For guest users, just store locally (could use AsyncStorage if needed)
        console.log('Guest user interests:', selectedInterests);
      }

      // Navigate to onboarding screen
      router.replace('/onboarding');
    } catch (error: any) {
      console.error('Error saving interests:', error);
      Alert.alert('Error', 'Failed to save interests. Please try again.');
    } finally {
      setLoading(false);
    }
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
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>Choose Your Interests</Text>
          </View>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>
              Pick a few topics you love so we can tailor your feed.
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <View style={styles.searchIconContainer}>
              <SvgXml xml={searchIconSvg} width={24} height={24} />
            </View>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="#99A1BD"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        </View>

        {/* Interests Grid */}
        <View style={styles.interestsContainer}>
          {filteredInterests.map((interest) => (
            <Pressable
              key={interest}
              style={[
                styles.interestChip,
                selectedInterests.includes(interest) && styles.interestChipSelected,
              ]}
              onPress={() => toggleInterest(interest)}
            >
              <Text
                style={[
                  styles.interestText,
                  selectedInterests.includes(interest) && styles.interestTextSelected,
                ]}
              >
                {interest}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom }]}>
        <View style={styles.buttonWrapper}>
          <Pressable
            style={[
              styles.continueButton,
              (selectedInterests.length === 0 || loading) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={selectedInterests.length === 0 || loading}
          >
            <Text style={styles.continueButtonText}>
              {loading ? 'Saving...' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1217',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    alignSelf: 'stretch',
  },
  titleWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 23,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#99A1BD',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchIconContainer: {
    backgroundColor: '#262B3B',
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  searchInputContainer: {
    flex: 1,
    backgroundColor: '#262B3B',
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  searchInput: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    padding: 0,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  interestChip: {
    backgroundColor: '#262B3B',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
  },
  interestChipSelected: {
    backgroundColor: '#5C80FF',
  },
  interestText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  interestTextSelected: {
    color: '#FFFFFF',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F1217',
  },
  buttonWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#5C80FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
