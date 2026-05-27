import SliderEntry from "@/components/slide";
import { ImageSliderType } from "@/types/slide";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Dimensions, StyleSheet, View, ViewToken } from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import Pagination from "./Pagination";

type Props = {
  itemList: ImageSliderType[];
};

function SlideAnimate({ itemList }: Props) {
  const scrollX = useSharedValue(0);
  const [paginationIndex, setPaginationIndex] = useState(0);
  const { width } = Dimensions.get("screen");
  const data = [...itemList, ...itemList, ...itemList];
  const ref = useAnimatedRef<Animated.FlatList<ImageSliderType>>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndexRef = useRef(0);
  const isAutoPlay = true;

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const onViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ViewToken[];
  }) => {
    if (itemList.length === 0) {
      setPaginationIndex(0);
      return;
    }

    const firstVisibleIndex = viewableItems[0]?.index;
    if (typeof firstVisibleIndex === "number") {
      setPaginationIndex(firstVisibleIndex % itemList.length);
    }
  };

  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]);

  const onScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;

      const contentOffset = event.contentOffset.x;
      const totalWidth = width * data.length;
      const singleListWidth = width * itemList.length;

      if (itemList.length === 0) {
        return;
      }

      if (contentOffset >= totalWidth - width) {
        ref.current?.scrollToOffset({
          offset: singleListWidth,
          animated: false,
        });
      } else if (contentOffset <= 0) {
        ref.current?.scrollToOffset({
          offset: singleListWidth * 2 - width,
          animated: false,
        });
      }
    },
  });

  useEffect(() => {
    if (!isAutoPlay || itemList.length === 0) {
      return;
    }

    intervalRef.current = setInterval(() => {
      const nextIndex = (currentIndexRef.current + 1) % itemList.length;
      const targetOffset = (itemList.length + nextIndex) * width;

      ref.current?.scrollToOffset({ offset: targetOffset, animated: true });
      currentIndexRef.current = nextIndex;
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoPlay, itemList.length, ref, width]);

  useEffect(() => {
    if (!ref.current || itemList.length === 0) {
      return;
    }

    const initialOffset = itemList.length * width;
    ref.current.scrollToOffset({
      offset: initialOffset,
      animated: false,
    });
    currentIndexRef.current = 0;
  }, [itemList.length, ref, width]);

  const renderItem = useCallback(
    ({ item, index }: { item: ImageSliderType; index: number }) => (
      <SliderEntry item={item} index={index} scrollX={scrollX} />
    ),
    [scrollX],
  );

  const getItemLayout = (
    data: ArrayLike<ImageSliderType> | null | undefined,
    index: number,
  ) => ({
    length: width,
    offset: width * index,
    index,
  });

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={ref}
        data={data}
        renderItem={renderItem}
        keyExtractor={(_, idx) => idx.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        onEndReached={() => {}}
        onEndReachedThreshold={0.5}
        style={styles.flatList}
        initialNumToRender={3}
        windowSize={3}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
      />
      <View style={styles.paginationContainer}>
        <Pagination
          items={itemList}
          scrollX={scrollX}
          paginationIndex={paginationIndex}
        />
      </View>
    </View>
  );
}

export default React.memo(SlideAnimate);

const styles = StyleSheet.create({
  container: {
    height: 190,
    width: "100%",
  },
  flatList: {
    height: "100%",
  },
  paginationContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
