import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface InsightCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

export default function InsightCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: InsightCardProps) {
  const handleDismiss = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  const handleAction = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAction?.();
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={8}
      >
        <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={32} color="#FFFFFF" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        {actionLabel && onAction && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handleAction}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4A9EFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  content: {
    gap: 16,
  },
  iconContainer: {
    alignSelf: 'flex-start',
  },
  textContainer: {
    gap: 8,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  message: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    alignSelf: 'flex-start',
  },
  actionButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
