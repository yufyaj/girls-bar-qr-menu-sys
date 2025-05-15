import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// セッション削除API
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;
    console.log('セッション削除API: リクエスト受信', { session_id });

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッションが存在するか確認
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !existingSession) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 会計済みのセッションか確認
    const { data: checkout, error: checkoutError } = await supabase
      .from('checkouts')
      .select('checkout_id, status')
      .eq('session_id', session_id)
      .eq('status', 'completed')
      .single();

    // 会計済みであればキャストに奢ったデータが安全に移行されているか確認
    if (checkout && checkout.status === 'completed') {
      // 会計履歴を確認
      const { data: history, error: historyError } = await supabase
        .from('checkout_history')
        .select('history_id')
        .eq('checkout_id', checkout.checkout_id)
        .single();

      if (!historyError && history) {
        // キャストに奢ったアイテムがあるかチェック
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            order_id,
            order_items (
              product_id,
              product_name,
              price,
              quantity,
              target_cast_id
            )
          `)
          .eq('session_id', session_id)
          .eq('status', 'closed');

        if (!ordersError && orders) {
          // キャストに奢った注文を抽出
          const treatedItems = [];
          for (const order of orders) {
            if (order.order_items) {
              for (const item of order.order_items) {
                if (item.target_cast_id) {
                  treatedItems.push(item);
                }
              }
            }
          }

          // キャストに奢ったアイテムがある場合、レポート用のテーブルに移行されているか確認
          if (treatedItems.length > 0) {
            console.log(`キャストに奢ったアイテムが${treatedItems.length}件見つかりました`);
            
            // レポート用テーブルに移行されているか確認
            const { count: savedCount, error: checkError } = await supabase
              .from('checkout_order_items')
              .select('*', { count: 'exact', head: true })
              .eq('history_id', history.history_id)
              .not('target_cast_id', 'is', null);

            if (!checkError) {
              // savedCountはnumberまたはnull
              const actualCount = savedCount || 0;
              
              // 移行されたアイテム数と元のアイテム数が一致しない場合は追加で移行
              if (actualCount < treatedItems.length) {
                console.log(`キャスト奢りデータの移行に不足があります: 元=${treatedItems.length}件、移行済=${actualCount}件`);

                // 追加で移行するアイテムを作成
                const additionalItems = [];
                for (const item of treatedItems) {
                  // ターゲットキャスト情報を取得
                  const { data: castData } = await supabase
                    .from('store_users')
                    .select('display_name')
                    .eq('user_id', item.target_cast_id)
                    .eq('store_id', existingSession.store_id)
                    .single();

                  additionalItems.push({
                    history_id: history.history_id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: item.price * item.quantity,
                    target_cast_id: item.target_cast_id,
                    target_cast_name: castData?.display_name || 'キャスト',
                    ordered_at: new Date().toISOString()
                  });
                }

                // 追加データを保存
                if (additionalItems.length > 0) {
                  const { error: insertError } = await supabase
                    .from('checkout_order_items')
                    .insert(additionalItems);

                  if (insertError) {
                    console.error('追加キャスト奢りデータ保存エラー:', insertError);
                  } else {
                    console.log(`追加で${additionalItems.length}件のキャスト奢りデータを保存しました`);
                  }
                }
              } else {
                console.log(`キャスト奢りデータは正常に移行されています: ${actualCount}件`);
              }
            }
          }
        }
      }
    }

    // セッションを削除
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.error('セッション削除エラー:', deleteError);
      return NextResponse.json(
        { error: 'セッションの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'セッションが正常に削除されました'
    });
  } catch (error) {
    console.error('セッション削除処理エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
