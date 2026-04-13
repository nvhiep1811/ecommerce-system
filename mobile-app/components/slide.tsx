// components/SliderEntry.js (ĐÃ SỬA CHUẨN CAROUSEL)

import { ImageSliderType } from "@/types/slide";
import React from 'react';
import { Dimensions, Image, StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
type Props = {
    item : ImageSliderType;
    index :number;
    scrollX:SharedValue<number>
}
const {width} = Dimensions.get('screen');

// 1. ĐỊNH NGHĨA KÍCH THƯỚC: Khoảng trống ở hai bên (cho phép nhìn thấy slide kế bên)
const ITEM_MARGIN = 35; 
// Chiều rộng thực tế của item slide (Chiều rộng màn hình - khoảng trống 2 bên)
const ITEM_WIDTH = width - (ITEM_MARGIN * 2); 


const SliderEntry = ({ item,index,scrollX }: Props) => {
  const rnAnimationStyle = useAnimatedStyle(()=>{
    // Điều chỉnh phép nội suy dựa trên ITEM_WIDTH/ITEM_MARGIN
    return{
      transform:[
        {translateX:interpolate(
          scrollX.value,
          [
                (index-40)*width,
                index*width,
                (index+50)*width
            ],
          [-(ITEM_MARGIN + 20), 0, (ITEM_MARGIN + 20)],
          Extrapolation.CLAMP
        ),
      },
      {
        scale:interpolate(
          scrollX.value,
          [(index-1)*width,index*width,(index+1)*width],
          [1,1,1],
           Extrapolation.CLAMP
        ),
      }
      ]
    }
  })
 return (
    <Animated.View style={[styles.slideContainer,rnAnimationStyle]}>
      <Image 
        source={item.image} 
        style={styles.image}
        resizeMode="cover" 
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
 slideContainer: {
   justifyContent:"center",
   alignItems:"center",
   height:200, 
   width:width, 
    overflow: 'hidden', 
    paddingHorizontal: ITEM_MARGIN, 
  },
  image: {
    width: ITEM_WIDTH+60, 
    height: '100%',
    borderRadius:20, 

  }
});

export default SliderEntry;