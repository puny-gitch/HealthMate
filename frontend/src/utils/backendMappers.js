export function mapProfile(profile = {}) {
  return {
    userId: profile.userId,
    username: profile.username || "",
    nickname: profile.username || "用户",
    gender: profile.gender,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    goal: profile.healthGoal || "保持健康",
    hasProfile: Boolean(profile.profileCompleted),
    medicalHistory: profile.medicalHistory || "暂无",
    injuryHistory: profile.injuryHistory || "",
    allergyHistory: profile.allergyHistory || "",
    healthGoalVersion: profile.healthGoalVersion || "",
  };
}

export function mapHealthRecord(record = {}) {
  return {
    id: record.recordId,
    summary: record.rawInput || "结构化健康记录",
    date: record.recordDate,
    mood: (record.healthTags || []).slice(0, 2).join(" / ") || record.confidence || "已记录",
    sleepMinutes: record.sleepMinutes,
    intakeCalories: record.estimatedIntakeKcal,
    exerciseCalories: record.estimatedBurnKcal,
    tags: record.healthTags || [],
  };
}

export function mapTask(task = {}, slot = "today") {
  const completed = task.status === 1;
  return {
    id: task.taskId,
    title: task.taskContent || "健康任务",
    reason: task.aiReason || "根据你的健康记录生成",
    completed,
    date: task.taskDate || new Date().toISOString().slice(0, 10),
    slot,
    category: "AI 建议",
    progress: completed ? 1 : 0,
    baseProgress: 0,
    target: 1,
    unit: "次",
    updatedAt: task.updatedAt,
  };
}

export function mapTrend(payload = {}) {
  const sleep = (payload.sleepSeries || []).map((value) => Number((Number(value || 0) / 60).toFixed(1)));
  const tags = Object.entries(payload.tagDistribution || {}).map(([name, value]) => ({ name, value }));
  return {
    categories: payload.categories || [],
    sleep,
    intake: payload.intakeSeries || [],
    burn: payload.burnSeries || [],
    tags,
    insight: payload.categories?.length ? "已汇总近期健康记录。" : "暂无健康记录，完成记录后可查看趋势。",
    notices: tags.length ? tags.slice(0, 2).map((tag) => `${tag.name} 出现 ${tag.value} 次`) : ["暂无标签分布"],
  };
}

export function mapParsedHealth(payload = {}) {
  const preview = payload.previewData || payload;
  return {
    parseId: payload.parseId || "",
    shouldSave: payload.shouldSave !== false,
    failureReason: payload.failureReason || "",
    suggestions: payload.suggestions || [],
    warnings: payload.warnings || preview.parseWarnings || [],
    confidenceScore: payload.confidenceScore ?? null,
    previewData: preview,
    rawInput: preview.rawInput || "",
    recordedAt: preview.recordedAt || new Date().toISOString(),
    recordDate: preview.recordDate || new Date().toISOString().slice(0, 10),
    sleepHours: Number(((preview.sleepMinutes || 0) / 60).toFixed(1)),
    sleepMinutes: preview.sleepMinutes || 0,
    intakeCalories: preview.intakeCalories ?? preview.estimatedIntakeKcal ?? 0,
    exerciseCalories: preview.exerciseCalories ?? preview.estimatedBurnKcal ?? 0,
    tags: preview.healthTags || [],
    nutritionDetails: preview.nutritionDetails || {},
    exerciseDetails: preview.exerciseDetails || {},
    confidence: payload.confidence || "low",
    note: `解析置信度：${payload.confidence || "low"}`,
  };
}
