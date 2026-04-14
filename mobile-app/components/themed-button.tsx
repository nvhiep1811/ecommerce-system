import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  lightColor?: string;
  darkColor?: string;
  title: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function Button({
  style,
  textStyle,
  lightColor,
  darkColor,
  title,
  ...otherProps
}: ButtonProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'tint');
  const color = useThemeColor({}, 'background');

  return (
    <Pressable style={[styles.button, { backgroundColor }, style]} {...otherProps}>
      <Text style={[styles.text, { color }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 5,
    padding: 10,
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
