const highRiskWords = ["胸痛", "呼吸困难", "晕厥", "便血", "呕血", "抽搐", "剧烈头痛", "心梗", "自杀", "抑郁发作"];

export function detectHighRisk(input) {
  const text = `${input || ""}`.toLowerCase();
  return highRiskWords.some((word) => text.includes(word.toLowerCase()));
}

export function findHighRiskWords(input) {
  const text = `${input || ""}`.toLowerCase();
  return highRiskWords.filter((word) => text.includes(word.toLowerCase()));
}

export function buildRiskMessage(input) {
  const words = findHighRiskWords(input);
  if (!words.length) return "";
  return `检测到可能涉及病痛或高危症状（${words.join("、")}），本条记录不会保存，请及时就医或咨询专业医生。`;
}

export function getRiskWords() {
  return [...highRiskWords];
}
