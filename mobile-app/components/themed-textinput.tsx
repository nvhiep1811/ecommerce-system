import { useThemeColor } from "@/hooks/use-theme-color";
import React, { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

export type ThemedTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "text" | "password" | "email" | "number" | "phone" | "otp";
  style?: object;
  returnKeyType?: "done" | "go" | "next" | "search" | "send" | "default";
  blurOnSubmit?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoComplete?:
    | "off"
    | "email"
    | "name"
    | "tel"
    | "username"
    | "password"
    | "new-password"
    | "one-time-code"
    | string;
  textContentType?:
    | "emailAddress"
    | "name"
    | "telephoneNumber"
    | "password"
    | "newPassword"
    | "oneTimeCode"
    | string;
};

export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(
  (props, ref) => {
    const {
      style,
      lightColor,
      darkColor,
      type = "text",
      returnKeyType,
      blurOnSubmit,
      autoCapitalize,
      autoCorrect,
      autoComplete,
      textContentType,
      ...otherProps
    } = props;

    const backgroundColor = useThemeColor(
      { light: lightColor, dark: darkColor },
      "background",
    );
    const textColor = useThemeColor({ light: "#000", dark: "#fff" }, "text");
    const placeholderTextColor = useThemeColor(
      { light: "#888", dark: "#888" },
      "text",
    );

    // Determine keyboard type
    const keyboardType =
      type === "email"
        ? "email-address"
        : type === "number"
          ? "numeric"
          : type === "phone"
            ? "phone-pad"
            : type === "otp"
              ? "number-pad"
              : "default";

    const secureTextEntry = type === "password";

    // Determine default autocapitalize behavior
    const finalAutoCapitalize =
      autoCapitalize !== undefined
        ? autoCapitalize
        : type === "email" || type === "password" || type === "otp"
          ? "none"
          : type === "phone" || type === "number"
            ? "none"
            : "sentences";

    // Determine default autoCorrect
    const finalAutoCorrect =
      autoCorrect !== undefined
        ? autoCorrect
        : type === "email" || type === "password" || type === "phone"
          ? false
          : true;

    // Determine default autoComplete
    const finalAutoComplete =
      autoComplete !== undefined
        ? autoComplete
        : type === "email"
          ? "email"
          : type === "phone"
            ? "tel"
            : type === "password"
              ? "password"
              : type === "otp"
                ? "one-time-code"
                : "off";

    // Determine default textContentType
    const finalTextContentType =
      textContentType !== undefined
        ? textContentType
        : type === "email"
          ? "emailAddress"
          : type === "phone"
            ? "telephoneNumber"
            : type === "password"
              ? "password"
              : type === "otp"
                ? "oneTimeCode"
                : undefined;

    return (
      <TextInput
        ref={ref}
        style={[
          { backgroundColor, color: textColor, padding: 10, borderRadius: 5 },
          style,
        ]}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholderTextColor={placeholderTextColor}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit ?? true}
        autoCapitalize={finalAutoCapitalize}
        autoCorrect={finalAutoCorrect}
        autoComplete={finalAutoComplete}
        textContentType={finalTextContentType}
        {...otherProps}
      />
    );
  },
);

ThemedTextInput.displayName = "ThemedTextInput";
