import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

import { ImageSliderType } from "@/types/slide";

type Props = {
  items: ImageSliderType[];
  paginationIndex: number;
  scrollX: SharedValue<number>;
};

type PaginationDotProps = {
  index: number;
  itemCount: number;
  paginationIndex: number;
  scrollX: SharedValue<number>;
};

const { width } = Dimensions.get("screen");

function PaginationDot({
  index,
  itemCount,
  paginationIndex,
  scrollX,
}: PaginationDotProps) {
  const centerOffset = (index + itemCount) * width;

  const animatedStyle = useAnimatedStyle(() => {
    const dotWidth = interpolate(
      scrollX.value,
      [centerOffset - width, centerOffset, centerOffset + width],
      [8, 20, 8],
      Extrapolation.CLAMP,
    );

    return {
      width: dotWidth,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        animatedStyle,
        { backgroundColor: paginationIndex === index ? "#555" : "#aaa" },
      ]}
    />
  );
}

export default function Pagination({ items, paginationIndex, scrollX }: Props) {
  return (
    <View style={styles.container}>
      {items.map((_, index) => (
        <PaginationDot
          key={index}
          index={index}
          itemCount={items.length}
          paginationIndex={paginationIndex}
          scrollX={scrollX}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  dot: {
    height: 8,
    marginHorizontal: 2,
    borderRadius: 8,
  },
});
