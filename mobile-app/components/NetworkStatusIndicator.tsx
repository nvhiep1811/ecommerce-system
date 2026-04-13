import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface NetworkStatusIndicatorProps {
  showText?: boolean;
  compact?: boolean;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  showText = true,
  compact = false,
}) => {
  const { isConnected, connectionType } = useNetworkStatus();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isConnected ? '#10B981' : '#EF4444' },
          ]}
        />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.statusIndicator,
          { backgroundColor: isConnected ? '#10B981' : '#EF4444' },
        ]}
      />
      {showText && (
        <ThemedText style={styles.statusText}>
          {isConnected
            ? `Online (${connectionType})`
            : 'Offline - Working locally'
          }
        </ThemedText>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactContainer: {
    padding: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
