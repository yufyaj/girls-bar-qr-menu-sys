-- テーブル移動時の料金計算が重複して加算される問題を修正
-- fn_calc_total_charge関数は既に修正済みのため、変更なし

-- コメント追加
COMMENT ON FUNCTION public.fn_calc_total_charge(uuid) IS 'テーブル移動時の料金計算が重複して加算される問題を修正（2025/08/05）';
