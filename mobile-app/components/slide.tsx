import { ImageSliderType } from "@/types/slide";
import React from "react";
import { Dimensions, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

type Props = {
  item: ImageSliderType;
  index: number;
  scrollX: SharedValue<number>;
};

const { width } = Dimensions.get("screen");
const ITEM_MARGIN = 16;
const ITEM_WIDTH = width - ITEM_MARGIN * 2;

export default function SliderEntry({ item, index, scrollX }: Props) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [(index - 40) * width, index * width, (index + 50) * width],
          [0, 0, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollX.value,
          [(index - 1) * width, index * width, (index + 1) * width],
          [1, 1, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.slideContainer, animatedStyle]}>
      <Image source={item.image} style={styles.image} contentFit="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slideContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: 190,
    width,
    overflow: "hidden",
    paddingHorizontal: ITEM_MARGIN,
  },
  image: {
    width: ITEM_WIDTH,
    height: "100%",
    borderRadius: 26,
  },
});
