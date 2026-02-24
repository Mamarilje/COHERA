import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface PriorityBadgeProps {
  priority: 'High' | 'Medium' | 'Low';
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const getBadgeStyle = () => {
    switch (priority) {
      case 'High':
        return styles.high;
      case 'Medium':
        return styles.medium;
      case 'Low':
        return styles.low;
      default:
        return styles.low;
    }
  };

  const getText = () => priority.toUpperCase();

  return (
    <View style={[styles.badge, getBadgeStyle()]}>
      <ThemedText style={styles.text}>{getText()}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  high: {
    backgroundColor: '#FF6B6B',
  },
  medium: {
    backgroundColor: '#FFA726',
  },
  low: {
    backgroundColor: '#66BB6A',
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
