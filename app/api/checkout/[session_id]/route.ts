import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getSmaregiAccessToken, registerSmaregiTransaction } from '@/lib/smaregi';

export async function POST(
  request: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const { session_id } = params;
    const data = await request.json();
    const { table_id } = data;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        session_id,
        store_id,
        table_id,
        start_at,
        charge_started_at,
        selected_cast_id,
        guest_count,
        tables (
          table_id,
          seat_type_id,
          seat_types (
            seat_type_id,
            price_per_unit,
            time_unit_minutes,
            display_name
          )
        )
      `)
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 注文合計を計算
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        order_id,
        order_items (
          order_item_id,
          product_id,
          product_name,
          price,
          quantity,
          target_cast_id
        )
      `)
      .eq('session_id', session_id)
      .eq('status', 'new')
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('注文取得エラー:', ordersError);
      return NextResponse.json(
        { error: '注文情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 注文合計金額を計算
    let orderAmount = 0;
    if (orders && orders.length > 0) {
      for (const order of orders) {
        if (order.order_items && order.order_items.length > 0) {
          for (const item of order.order_items) {
            orderAmount += item.price * item.quantity;
          }
        }
      }
    }

    // テーブル料金を計算（データベース関数を使用）
    // fn_calc_total_charge関数は既にis_table_move_charge=trueのイベントの料金を含めて計算している
    const { data: chargeAmount, error: chargeError } = await supabase
      .rpc('fn_calc_total_charge', { p_session_id: session_id });

    if (chargeError) {
      console.error('テーブル料金計算エラー:', chargeError);
      return NextResponse.json(
        { error: 'テーブル料金の計算に失敗しました' },
        { status: 500 }
      );
    }

    // 席移動による料金の内訳を取得（表示用）
    let moveChargeAmount = 0;
    try {
      // is_table_move_chargeフィールドが存在する場合
      const { data: moveCharges, error: moveChargeError } = await supabase
        .from('session_seat_events')
        .select('price_snapshot')
        .eq('session_id', session_id)
        .eq('is_table_move_charge', true);

      if (!moveChargeError && moveCharges && moveCharges.length > 0) {
        for (const charge of moveCharges) {
          moveChargeAmount += charge.price_snapshot;
        }
      }
    } catch (error) {
      console.error('席移動料金取得例外:', error);
      // エラーがあっても処理は続行
    }

    console.log('席移動料金:', moveChargeAmount);
    console.log('合計テーブル料金:', chargeAmount);

    // 指名料を計算（新しいテーブルから複数の指名を取得）
    let nominationFee = 0;
    let nominations: Array<{
      nomination_id: string | null;
      cast_id: string | null;
      nomination_fee: number;
      created_at: string;
      display_name?: string;
    }> = [];

    try {
      // session_cast_nominationsテーブルから指名情報を取得
      const { data: nominationsData, error: nominationsError } = await supabase
        .from('session_cast_nominations')
        .select(`
          nomination_id,
          cast_id,
          nomination_fee,
          created_at
        `)
        .eq('session_id', session_id);

      if (!nominationsError && nominationsData && nominationsData.length > 0) {
        // 指名料の合計を計算
        for (const nomination of nominationsData) {
          nominationFee += nomination.nomination_fee || 0;
        }
        nominations = nominationsData;
        console.log('指名料合計:', nominationFee);
        console.log('指名数:', nominations.length);
      } else {
        // 後方互換性のために、sessionsテーブルのselected_cast_idも確認
        if (session.selected_cast_id) {
          try {
            // 指名されたキャストの情報を取得
            const { data: castData, error: castError } = await supabase
              .from('store_users')
              .select('nomination_fee, display_name')
              .eq('user_id', session.selected_cast_id)
              .eq('store_id', session.store_id)
              .eq('role', 'cast')
              .single();

            if (!castError && castData) {
              nominationFee = castData.nomination_fee || 0;
              console.log('旧方式の指名料:', nominationFee);

              // 後方互換性のために、nominationsにも追加
              if (nominationFee > 0) {
                nominations.push({
                  nomination_id: null,
                  cast_id: session.selected_cast_id,
                  nomination_fee: nominationFee,
                  created_at: new Date().toISOString(),
                  display_name: castData.display_name || 'キャスト'
                });
              }
            }
          } catch (error) {
            console.error('旧方式の指名料取得例外:', error);
          }
        }
      }
    } catch (error) {
      console.error('指名料取得例外:', error);
      // エラーがあっても処理は続行
    }

    // 合計金額を計算（税込み）
    const totalAmount = orderAmount + (chargeAmount || 0) + nominationFee;

    // 店舗情報を取得（スマレジ連携の確認と税率）
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('enable_smaregi_integration, smaregi_client_id, smaregi_client_secret, smaregi_contract_id, tax_rate')
      .eq('store_id', session.store_id)
      .single();

    if (storeError) {
      console.error('店舗情報取得エラー:', storeError);
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 店舗の消費税率を取得
    const taxRate = store.tax_rate !== undefined ? store.tax_rate : 10.0;

    // 内税の消費税額を計算（税込み金額から逆算）
    // 税込み金額 ÷ (1 + 税率/100) = 税抜き金額
    // 税込み金額 - 税抜き金額 = 消費税額
    const subtotalAmount = Math.floor(totalAmount / (1 + taxRate / 100));
    const taxAmount = totalAmount - subtotalAmount;

    // 会計情報をcheckoutsテーブルに保存
    const { data: checkout, error: checkoutError } = await supabase
      .from('checkouts')
      .insert({
        store_id: session.store_id,
        session_id: session_id,
        total_amount: totalAmount,
        charge_amount: chargeAmount,
        order_amount: orderAmount,
        nomination_fee: nominationFee,
        status: 'pending'
      })
      .select()
      .single();

    if (checkoutError) {
      console.error('会計情報保存エラー:', checkoutError);
      return NextResponse.json(
        { error: '会計情報の保存に失敗しました' },
        { status: 500 }
      );
    }

    // スマレジ連携が有効な場合、スマレジAPIに会計データを送信
    if (store.enable_smaregi_integration) {
      try {
        // スマレジAPIのアクセストークンを取得
        const accessToken = await getSmaregiAccessToken(
          store.smaregi_client_id,
          store.smaregi_client_secret,
          store.smaregi_contract_id,
          'pos.transactions:write'
        );

        // 現在の日時を取得（スマレジAPIの日時フォーマットに合わせる）
        const now = new Date();
        // スマレジAPIの日時フォーマット: ISO 8601形式（YYYY-MM-DDTHH:mm:ss+XX:XX）
        // ミリ秒部分を削除し、タイムゾーン部分を調整
        const isoString = now.toISOString();
        const transactionDateTime = isoString.substring(0, 19) + '+09:00'; // 日本時間（+09:00）

        // 取引IDを生成（10文字以下にする必要がある）
        // 秒単位の時間（Unix時間の下4桁）+ 3桁のランダム数字で7桁の一意なIDを生成
        const timeComponent = Math.floor(now.getTime() / 1000).toString().slice(-4);
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const terminalTranId = timeComponent + randomNum;

        // 注文明細を作成
        const details = [];
        let detailId = 1;

        if (orders && orders.length > 0) {
          for (const order of orders) {
            if (order.order_items && order.order_items.length > 0) {
              for (const item of order.order_items) {
                // 商品情報を取得
                // order_itemsテーブルにはproduct_idとproduct_nameが保存されているため、
                // まずはそれらを使用する
                let productId = "1"; // デフォルト値
                let productName = item.product_name || "商品名不明";

                // product_idが存在する場合は、それを使用してスマレジ用のIDを生成
                if (item.product_id) {
                  // product_idが数値の場合はそのまま使用
                  if (/^\d+$/.test(item.product_id)) {
                    productId = item.product_id;
                  } else {
                    // 数値でない場合は、product_idのハッシュから数値を生成
                    // 単純な方法として、文字列の各文字のコードポイントを合計
                    const hash = Array.from(item.product_id as string)
                      .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9000 + 1000;
                    productId = hash.toString();
                  }
                }

                // 念のため、menusテーブルからも商品情報を取得してみる
                try {
                  const { data: menuItem } = await supabase
                    .from('menus')
                    .select('product_id, name')
                    .eq('store_id', session.store_id)
                    .eq('product_id', item.product_id)
                    .single();

                  // メニュー情報が取得できた場合は、その名前を使用
                  if (menuItem?.name) {
                    productName = menuItem.name;
                  }
                } catch (error) {
                  console.log(`メニュー情報取得エラー (product_id: ${item.product_id}):`, error);
                  // エラーが発生しても処理は続行
                }

                const detailIdStr = detailId.toString().padStart(3, '0');

                details.push({
                  transactionDetailId: detailIdStr,
                  parentTransactionDetailId: detailIdStr,
                  transactionDetailDivision: "1", // 通常商品
                  productId: productId,
                  productName: productName,
                  printReceiptProductName: productName,
                  taxDivision: "2", // 内税
                  price: item.price.toString(),
                  salesPrice: item.price.toString(),
                  quantity: item.quantity.toString()
                });

                detailId++;
              }
            }
          }
        }

        // テーブル料金を追加（サービス料として）
        if (chargeAmount && chargeAmount > 0) {
          const detailIdStr = detailId.toString().padStart(3, '0');

          // テーブルIDからテーブル料金用の商品IDを生成
          // テーブルIDのハッシュから数値を生成（8000-8999の範囲）
          const tableHash = Array.from(table_id as string)
            .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 1000 + 8000;

          // テーブル情報を取得
          const { data: tableData } = await supabase
            .from('tables')
            .select('name, seat_type_id')
            .eq('table_id', table_id)
            .single();

          const tableName = tableData?.name || 'テーブル';

          // 席種情報を取得
          let productId = tableHash.toString(); // テーブルハッシュを使用
          let productName = `${tableName}料金`;
          let skipTableCharge = false; // テーブル料金をスキップするかどうか

          if (tableData?.seat_type_id) {
            const { data: seatTypeData } = await supabase
              .from('seat_types')
              .select('display_name')
              .eq('seat_type_id', tableData.seat_type_id)
              .single();

            if (seatTypeData?.display_name) {
              productName = `${seatTypeData.display_name || tableName}料金`;
            }
          }

          // テーブル料金を追加
          {
            details.push({
              transactionDetailId: detailIdStr,
              parentTransactionDetailId: detailIdStr,
              transactionDetailDivision: "1", // 通常商品
              productId: productId,
              productName: productName,
              printReceiptProductName: productName,
              taxDivision: "2", // 内税
              price: chargeAmount.toString(),
              salesPrice: chargeAmount.toString(),
              quantity: "1"
            });
          }

          // 指名料がある場合は追加
          if (nominationFee > 0 && nominations.length > 0) {
            // キャスト情報を取得
            const castIds = nominations.map(nom => nom.cast_id);
            const { data: castsData, error: castsError } = await supabase
              .from('store_users')
              .select('user_id, display_name')
              .eq('store_id', session.store_id)
              .eq('role', 'cast')
              .in('user_id', castIds);

            // キャスト名のマップを作成
            const castNameMap: Record<string, string> = {};
            if (!castsError && castsData) {
              castsData.forEach(cast => {
                if (cast.user_id) {
                  castNameMap[cast.user_id] = cast.display_name || 'キャスト';
                }
              });
            }

            // 各指名ごとに明細を追加
            for (const nomination of nominations) {
              detailId++;
              const nominationDetailIdStr = detailId.toString().padStart(3, '0');

              // 指名料用の商品IDを生成（9000-9999の範囲）
              const castHash = nomination.cast_id
                ? Array.from(nomination.cast_id as string)
                  .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 1000 + 9000
                : 9000;

              // キャスト名を取得
              const castName = nomination.cast_id && castNameMap[nomination.cast_id] || nomination.display_name || "キャスト";

              details.push({
                transactionDetailId: nominationDetailIdStr,
                parentTransactionDetailId: nominationDetailIdStr,
                transactionDetailDivision: "1", // 通常商品
                productId: castHash.toString(),
                productName: `${castName}指名料`,
                printReceiptProductName: `${castName}指名料`,
                taxDivision: "2", // 内税
                price: nomination.nomination_fee.toString(),
                salesPrice: nomination.nomination_fee.toString(),
                quantity: "1"
              });
            }
          }
        }

        // 内税計算のため、税抜き金額と消費税額を使用
        const smaregiTaxAmount = taxAmount;

        // 明細の合計金額を計算（スマレジAPIでは小計は明細合計と一致する必要がある）
        let detailsTotal = 0;
        details.forEach(detail => {
          detailsTotal += parseInt(detail.price) * parseInt(detail.quantity);
        });

        // スマレジAPIの内税方式の仕様に合わせて設定
        // 内税方式では、taxExcludeは0、totalはsubtotalと同じ値にする
        // 内税額はtaxIncludeフィールドに設定する

        // スマレジAPIに送信するデータを作成
        const transactionData = {
          transactionHeadDivision: "1", // 通常取引
          cancelDivision: "0", // 取消区分：通常
          subtotal: detailsTotal.toString(), // 明細合計（税込み）
          taxExclude: "0", // 外税（内税方式では0）
          taxInclude: smaregiTaxAmount.toString(), // 内税
          total: detailsTotal.toString(), // 税込み合計金額（内税方式ではsubtotalと同じ）
          storeId: "1", // 店舗ID（スマレジ側の店舗ID）
          terminalId: "1", // 端末ID（スマレジ側の端末ID）
          terminalTranId: terminalTranId,
          terminalTranDateTime: transactionDateTime,
          details: details
        };

        // スマレジAPIに取引データを送信
        const smaregiResponse = await registerSmaregiTransaction(
          accessToken,
          store.smaregi_contract_id,
          transactionData
        );

        console.log('スマレジ取引登録レスポンス:', smaregiResponse);

        // 会計ステータスを完了に更新し、スマレジのレシートIDを保存
        const { error: updateError } = await supabase
          .from('checkouts')
          .update({
            status: 'completed',
            smaregi_receipt_id: smaregiResponse.id || terminalTranId
          })
          .eq('checkout_id', checkout.checkout_id);

        if (updateError) {
          console.error('会計ステータス更新エラー:', updateError);
          return NextResponse.json(
            { error: '会計ステータスの更新に失敗しました' },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error('スマレジ連携エラー:', error);

        // スマレジ連携に失敗しても会計自体は完了させる
        const { error: updateError } = await supabase
          .from('checkouts')
          .update({
            status: 'completed'
          })
          .eq('checkout_id', checkout.checkout_id);

        if (updateError) {
          console.error('会計ステータス更新エラー:', updateError);
          return NextResponse.json(
            { error: '会計ステータスの更新に失敗しました' },
            { status: 500 }
          );
        }
      }
    } else {
      // スマレジ連携が無効の場合は、そのまま会計完了とする
      const { error: updateError } = await supabase
        .from('checkouts')
        .update({
          status: 'completed'
        })
        .eq('checkout_id', checkout.checkout_id);

      if (updateError) {
        console.error('会計ステータス更新エラー:', updateError);
        return NextResponse.json(
          { error: '会計ステータスの更新に失敗しました' },
          { status: 500 }
        );
      }
    }

    // 注文ステータスを更新（closedに変更）
    if (orders && orders.length > 0) {
      const orderIds = orders.map(order => order.order_id);
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'closed'
        })
        .in('order_id', orderIds);

      if (orderUpdateError) {
        console.error('注文ステータス更新エラー:', orderUpdateError);
        // エラーがあっても処理は続行
      }
    }

    // 会計履歴を保存（セッション削除前に履歴データを退避）
    try {
      console.log('会計履歴を保存します...');

      // テーブル情報を取得
      const { data: tableInfo, error: tableError } = await supabase
        .from('tables')
        .select(`
          name,
          seat_types (
            display_name
          )
        `)
        .eq('table_id', session.table_id)
        .single();

      if (tableError) {
        console.error('テーブル情報取得エラー:', tableError);
        // エラーがあっても処理は続行
      }

      // 滞在時間を計算（分単位）
      const startTime = session.charge_started_at ? new Date(session.charge_started_at) : new Date(session.start_at || new Date());
      const checkoutTime = new Date();
      const stayMinutes = Math.floor((checkoutTime.getTime() - startTime.getTime()) / (1000 * 60));

      // 会計履歴を保存
      const { data: history, error: historyError } = await supabase
        .from('checkout_history')
        .insert({
          checkout_id: checkout.checkout_id,
          store_id: session.store_id,
          table_id: session.table_id,
          table_name: tableInfo?.name || '不明なテーブル',
          seat_type_name: tableInfo?.seat_types?.[0]?.display_name || '不明な席種',
          
          // 金額情報
          total_amount: totalAmount,
          subtotal_amount: subtotalAmount,
          charge_amount: chargeAmount || 0,
          order_amount: orderAmount,
          nomination_fee: nominationFee,
          tax_amount: taxAmount,
          tax_rate: taxRate,
          
          // セッション情報
          session_start_at: session.start_at || new Date(),
          charge_started_at: session.charge_started_at,
          checkout_at: new Date(),
          stay_minutes: stayMinutes,
          guest_count: session.guest_count || 1,
          
          // 参照情報
          smaregi_receipt_id: checkout.smaregi_receipt_id
        })
        .select()
        .single();

      if (historyError) {
        console.error('会計履歴保存エラー:', historyError);
        // エラーがあっても処理は続行
      } else {
        console.log('会計履歴を保存しました。history_id:', history.history_id);

        // 注文明細を保存
        if (orders && orders.length > 0) {
          // すべての注文明細を取得
          const allOrderItems = [];
          for (const order of orders) {
            if (order.order_items && order.order_items.length > 0) {
              // 注文日時を取得
              const { data: orderData } = await supabase
                .from('orders')
                .select('created_at')
                .eq('order_id', order.order_id)
                .single();
                
              const orderCreatedAt = orderData?.created_at || new Date().toISOString();
              
              for (const item of order.order_items) {
                // 注文アイテムにtarget_cast_idが存在するか確認
                const targetCastId = (item as any).target_cast_id || null;
                
                // デバッグログ: target_cast_idの値をチェック
                console.log(`注文アイテム ${item.product_name} のtarget_cast_id: `, item.target_cast_id);
                console.log('アイテムの完全な内容:', JSON.stringify(item, null, 2));
                
                // ターゲットキャスト情報を取得
                let targetCastName = null;
                if (targetCastId) {
                  const { data: castData } = await supabase
                    .from('store_users')
                    .select('display_name')
                    .eq('user_id', targetCastId)
                    .eq('store_id', session.store_id)
                    .single();
                    
                  targetCastName = castData?.display_name || null;
                }
                
                allOrderItems.push({
                  history_id: history.history_id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  price: item.price,
                  quantity: item.quantity,
                  subtotal: item.price * item.quantity,
                  target_cast_id: targetCastId,
                  target_cast_name: targetCastName,
                  ordered_at: orderCreatedAt
                });
              }
            }
          }
          
          // 注文明細を一括保存
          if (allOrderItems.length > 0) {
            try {
              // 一度に保存するアイテム数が多すぎる場合はバッチ処理
              const BATCH_SIZE = 50;
              for (let i = 0; i < allOrderItems.length; i += BATCH_SIZE) {
                const batch = allOrderItems.slice(i, i + BATCH_SIZE);
                const { error: orderItemsError } = await supabase
                  .from('checkout_order_items')
                  .insert(batch);
                  
                if (orderItemsError) {
                  console.error(`バッチ${i/BATCH_SIZE + 1}の注文明細保存エラー:`, orderItemsError);
                  // エラーログを残すがバッチ処理は続行
                }
              }
              console.log(`${allOrderItems.length}件の注文明細を保存しました`);
              
              // 特にキャストへの奢りデータが存在する場合の検証
              const treatedItems = allOrderItems.filter(item => item.target_cast_id);
              if (treatedItems.length > 0) {
                console.log(`${treatedItems.length}件のキャスト奢りデータを保存しました`);
                
                // 保存されているか確認
                const { data: savedItems, error: checkError } = await supabase
                  .from('checkout_order_items')
                  .select('item_id, target_cast_id, target_cast_name')
                  .eq('history_id', history.history_id)
                  .not('target_cast_id', 'is', null);
                  
                if (checkError) {
                  console.error('キャスト奢りデータ確認エラー:', checkError);
                } else {
                  console.log(`確認: ${savedItems?.length || 0}件のキャスト奢りデータが保存されています`);
                }
              }
            } catch (batchError) {
              console.error('注文明細バッチ保存中にエラーが発生しました:', batchError);
              // 一括保存に失敗した場合の1件ずつの保存（最終手段）
              try {
                for (const item of allOrderItems) {
                  await supabase.from('checkout_order_items').insert([item]);
                }
                console.log('代替方法で注文明細を保存しました');
              } catch (fallbackError) {
                console.error('代替保存方法でもエラー:', fallbackError);
              }
            }
          }
        }
        
        // 指名情報を保存
        if (nominations && nominations.length > 0) {
          const nominationItems = [];
          
          for (const nomination of nominations) {
            // キャスト名を取得
            let castName = "不明なキャスト";
            if (nomination.cast_id) {
              const { data: castData } = await supabase
                .from('store_users')
                .select('display_name')
                .eq('user_id', nomination.cast_id)
                .eq('store_id', session.store_id)
                .single();
                
              castName = castData?.display_name || nomination.display_name || "不明なキャスト";
            } else if (nomination.display_name) {
              castName = nomination.display_name;
            }
            
            nominationItems.push({
              history_id: history.history_id,
              cast_id: nomination.cast_id,
              cast_name: castName,
              fee: nomination.nomination_fee
            });
          }
          
          // 指名情報を一括保存
          if (nominationItems.length > 0) {
            const { error: nominationsError } = await supabase
              .from('checkout_nominations')
              .insert(nominationItems);
              
            if (nominationsError) {
              console.error('指名情報保存エラー:', nominationsError);
              // エラーがあっても処理は続行
            } else {
              console.log(`${nominationItems.length}件の指名情報を保存しました`);
            }
          }
        }
      }
    } catch (historyError) {
      console.error('会計履歴保存中に例外が発生しました:', historyError);
      // 履歴保存に失敗しても会計処理自体は完了させる
    }

    // レスポンスデータを準備
    const responseData = {
      checkout_id: checkout.checkout_id,
      total_amount: totalAmount, // 税込み合計金額
      charge_amount: chargeAmount,
      order_amount: orderAmount,
      nomination_fee: nominationFee,
      nominations: nominations, // 指名情報を追加
      tax_amount: taxAmount, // 内税の消費税額
      tax_rate: taxRate,
      subtotal_amount: subtotalAmount, // 税抜き合計金額（内税から逆算）
      status: 'completed',
      guest_count: session.guest_count || 1 // 人数情報を追加（デフォルトは1人）
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('会計API: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
