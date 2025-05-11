-- 既存のカテゴリデータを新テーブルに移行するスクリプト

-- 一時的に各店舗ごとの一意なカテゴリ名を抽出して新テーブルに挿入
INSERT INTO public.menu_categories (store_id, name, display_order)
SELECT DISTINCT m.store_id, 
                COALESCE(m.category, '未分類') AS name, 
                ROW_NUMBER() OVER (PARTITION BY m.store_id ORDER BY MIN(m.created_at)) AS display_order
FROM public.menus m
GROUP BY m.store_id, COALESCE(m.category, '未分類');

-- 既存のメニューのcategory_idを更新
UPDATE public.menus m
SET category_id = mc.category_id
FROM public.menu_categories mc
WHERE m.store_id = mc.store_id 
AND COALESCE(m.category, '未分類') = mc.name;
