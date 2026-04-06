export function validatePassword(value) {
  if (!value) return "请输入密码";
  if (value.length < 6) return "密码至少 6 位";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "密码需包含字母和数字";
  return "";
}

export function passwordStrength(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 6) score += 1;
  if (/[A-Za-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export function validateAccount(value) {
  if (!value) return "请输入账号";
  if (value.length < 3) return "账号至少 3 位";
  return "";
}

export function validateRange(label, value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return `请输入有效${label}数值`;
  if (num < min || num > max) return `${label}需在 ${min}-${max} 范围内`;
  return "";
}
