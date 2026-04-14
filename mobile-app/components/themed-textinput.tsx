import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

export type ThemedTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'phone';
  style?: object;
};

export function ThemedTextInput(props: ThemedTextInputProps) {
    const { style, lightColor, darkColor, type = 'text', ...otherProps } = props;
    const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const placeholderTextColor = useThemeColor({ light: '#888', dark: '#888' }, 'text');
    const keyboardType =
      type === 'email'
        ? 'email-address'
        : type === 'number'
        ? 'numeric'
        : type === 'phone'
        ? 'phone-pad'
        : 'default';
    const secureTextEntry = type === 'password';

    return (
        <TextInput
            style={[{ backgroundColor, color: textColor, padding: 10, borderRadius: 5 }, style]}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            placeholderTextColor={placeholderTextColor}
            {...otherProps}
        />
    );
}
