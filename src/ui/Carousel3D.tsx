import { useState, type ReactElement } from 'react'
import { StyleSheet, type ListRenderItemInfo } from 'react-native'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useMotion } from './motion'
import { CAROUSEL, carouselOffset } from './motionMath'
import { space } from './tokens'

type Carousel3DProps<T> = {
  data: readonly T[]
  keyExtractor: (item: T) => string
  renderItem: (item: T, index: number) => ReactElement
  itemWidth: number
  gap?: number
  accessibilityLabel?: string
}

// Lista horizontal donde cada tarjeta gira hacia el centro. Sin WebGL: rotateY y scale nativos por tarjeta.
export function Carousel3D<T>({ data, keyExtractor, renderItem, itemWidth, gap = space.md, accessibilityLabel }: Carousel3DProps<T>) {
  const scrollX = useSharedValue(0)
  const [width, setWidth] = useState(0)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x
  })

  return (
    <Animated.FlatList
      horizontal
      data={data as T[]}
      keyExtractor={keyExtractor}
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      snapToInterval={itemWidth + gap}
      decelerationRate="fast"
      contentContainerStyle={[styles.track, { gap }]}
      accessibilityLabel={accessibilityLabel}
      renderItem={({ item, index }: ListRenderItemInfo<T>) => (
        <CarouselItem index={index} itemWidth={itemWidth} gap={gap} viewportWidth={width} scrollX={scrollX}>
          {renderItem(item, index)}
        </CarouselItem>
      )}
    />
  )
}

type CarouselItemProps = {
  index: number
  itemWidth: number
  gap: number
  viewportWidth: number
  scrollX: SharedValue<number>
  children: ReactElement
}

function CarouselItem({ index, itemWidth, gap, viewportWidth, scrollX, children }: CarouselItemProps) {
  const { reduced } = useMotion()
  const center = space.gutter + index * (itemWidth + gap) + itemWidth / 2
  const animated = useAnimatedStyle(() => {
    if (reduced || viewportWidth === 0) return { transform: [] }
    const off = carouselOffset(center, scrollX.value, viewportWidth)
    return {
      transform: [{ perspective: 800 }, { rotateY: `${-off * CAROUSEL.tiltDeg}deg` }, { scale: 1 - Math.abs(off) * CAROUSEL.shrink }],
    }
  })
  return <Animated.View style={[{ width: itemWidth }, animated]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  // Aire arriba y abajo para que la tarjeta girada no se corte.
  track: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
})
