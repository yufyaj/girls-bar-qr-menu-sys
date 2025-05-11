/**
 * 経過時間を指定された時間単位で切り上げる関数
 * @param minutes 経過時間（分）
 * @param timeUnitMinutes 時間単位（分）（デフォルトは30分）
 * @returns 指定された時間単位で切り上げた時間（分）
 */
export function roundUpToTimeUnit(minutes: number, timeUnitMinutes: number = 30): number {
  // 時間単位が無効な場合はデフォルトの30分を使用
  const validTimeUnit = timeUnitMinutes > 0 ? timeUnitMinutes : 30;

  // 1分未満の場合は時間単位として扱う（最低料金）
  // 0分だけでなく、数十秒など1分未満の場合も最低料金を適用
  if (minutes < 1) return validTimeUnit;

  return Math.ceil(minutes / validTimeUnit) * validTimeUnit;
}

/**
 * 2つの日時の間の経過時間を分単位で計算する
 * @param startTime 開始時間
 * @param endTime 終了時間
 * @param pauseTime 一時停止時間（オプション）
 * @returns 経過時間（分）
 */
export function calculateElapsedMinutes(
  startTime: Date,
  endTime: Date,
  pauseTime?: Date | null
): number {
  // 日時が無効な場合は0を返す
  if (!startTime || !endTime || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return 0;
  }

  // 一時停止中の場合
  if (pauseTime && !isNaN(pauseTime.getTime())) {
    // 一時停止時間が開始時間より前の場合は0を返す
    if (pauseTime.getTime() <= startTime.getTime()) {
      return 0;
    }

    // 一時停止時間が終了時間より後の場合は通常計算
    if (pauseTime.getTime() >= endTime.getTime()) {
      const diffMs = endTime.getTime() - startTime.getTime();
      return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60));
    }

    // 一時停止時間が開始時間と終了時間の間にある場合
    const diffMs = pauseTime.getTime() - startTime.getTime();
    return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60));
  }

  // 通常の計算
  const diffMs = endTime.getTime() - startTime.getTime();

  // 負の値になる場合は0を返す（異常値）
  if (diffMs < 0) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60));
}

/**
 * 経過時間と単価から料金を計算する
 * @param elapsedMinutes 経過時間（分）
 * @param pricePerUnit 時間単位あたりの単価（デフォルトは30分単位）
 * @param timeUnitMinutes 時間単位（分）（デフォルトは30分）
 * @param guestCount 人数（デフォルトは1人）
 * @returns 計算された料金
 */
export function calculateCharge(
  elapsedMinutes: number,
  pricePerUnit: number,
  timeUnitMinutes: number = 30,
  guestCount: number = 1
): number {
  // 単価が無効な場合は0を返す
  if (!pricePerUnit || pricePerUnit < 0) {
    return 0;
  }

  // 時間単位が無効な場合はデフォルトの30分を使用
  const validTimeUnit = timeUnitMinutes > 0 ? timeUnitMinutes : 30;

  // 人数が無効な場合はデフォルトの1人を使用
  const validGuestCount = guestCount > 0 ? guestCount : 1;

  // 時間単位で切り上げ（roundUpToTimeUnit関数を使用）
  const roundedMinutes = roundUpToTimeUnit(elapsedMinutes, validTimeUnit);

  // 時間単位の数を計算
  const units = roundedMinutes / validTimeUnit;

  // 料金を計算（人数分）
  return units * pricePerUnit * validGuestCount;
}

/**
 * 開始時間、終了時間、一時停止時間から料金を計算する
 * @param startTime 開始時間
 * @param endTime 終了時間
 * @param pricePerUnit 時間単位あたりの単価
 * @param timeUnitMinutes 時間単位（分）
 * @param pauseTime 一時停止時間（オプション）
 * @param guestCount 人数（デフォルトは1人）
 * @returns 計算された料金
 */
export function calculateChargeWithPause(
  startTime: Date,
  endTime: Date,
  pricePerUnit: number,
  timeUnitMinutes: number = 30,
  pauseTime?: Date | null,
  guestCount: number = 1
): number {
  // 経過時間を計算（一時停止を考慮）
  const elapsedMinutes = calculateElapsedMinutes(startTime, endTime, pauseTime);

  // 料金を計算（人数分）
  return calculateCharge(elapsedMinutes, pricePerUnit, timeUnitMinutes, guestCount);
}
