import { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { saveOnboardingDone } from "@/lib/storage";

const { width } = Dimensions.get("window");

const SLIDES = [
  { emoji: "💡", title: "지금 살까, 기다릴까?", desc: "환율·유가·금·항공권 시세를\n1년 분포로 한눈에 파악하세요." },
  { emoji: "📊", title: "통계 신호 제공", desc: "분위수 기반 buy/wait 신호로\n더 나은 타이밍을 잡아보세요." },
  { emoji: "🔔", title: "목표가 알림", desc: "원하는 가격 이하로 떨어지면\n즉시 알림을 받을 수 있어요." },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void saveOnboardingDone().then(() => router.replace("/"));
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />
      {/* 페이지 인디케이터 */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <Pressable style={styles.btn} onPress={next}>
        <Text style={styles.btnText}>
          {index < SLIDES.length - 1 ? "다음" : "시작하기"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17", justifyContent: "center" },
  slide: {
    width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { color: "#e6eef8", fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  desc: { color: "#9ca3af", fontSize: 15, lineHeight: 23, textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  dotActive: { backgroundColor: "#a3e635", width: 20 },
  btn: {
    marginHorizontal: 32,
    marginBottom: 48,
    backgroundColor: "#a3e635",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: { color: "#0b0f17", fontSize: 16, fontWeight: "800" },
});
