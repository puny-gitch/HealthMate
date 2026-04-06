const highRiskWords = ["胸痛", "呼吸困难", "晕厥", "便血", "呕血", "抽搐", "剧烈头痛", "心梗", "自杀", "抑郁发作"];

export function detectHighRisk(input) {
  const text = `${input || ""}`.toLowerCase();
  return highRiskWords.some((word) => text.includes(word.toLowerCase()));
}

export function getRiskWords() {
  return [...highRiskWords];
}
