import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";

const SECTIONS = [
  {
    title: "수집하는 개인정보",
    body: "얼말까는 다음 정보를 수집합니다.\n• 광고 식별자 (GAID/IDFA): 맞춤형 광고 제공\n• 앱 사용 패턴: 서비스 개선 목적\n• 기기 정보: OS 버전, 기기 모델",
  },
  {
    title: "제3자 제공",
    body: "Google AdMob을 통해 광고를 제공합니다. Google의 개인정보처리방침은 policies.google.com에서 확인하세요.",
  },
  {
    title: "보관 기간",
    body: "수집된 정보는 서비스 이용 기간 동안 보관되며, 서비스 해지 또는 앱 삭제 시 파기됩니다.",
  },
  {
    title: "이용자의 권리",
    body: "이용자는 언제든지 개인정보 열람, 수정, 삭제를 요청할 수 있습니다. 기기 설정에서 광고 추적을 제한할 수 있습니다.",
  },
  {
    title: "문의",
    body: "개인정보 관련 문의: wjs9280@gmail.com\n운영사: JayLabs",
  },
];

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "개인정보처리방침" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>최종 수정일: 2026년 6월 3일</Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  content: { padding: 20, paddingBottom: 48 },
  updated: { color: "#6b7280", fontSize: 12, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#e6eef8", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  sectionBody: { color: "#9ca3af", fontSize: 13, lineHeight: 21 },
});
