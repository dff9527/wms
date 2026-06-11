# Stage H — Cline (qwen3-coder-next) 任務包

> 產生時間:2026-06-11。前置:Stage G 已完成。
> 用法:一個任務開一個新 Cline session,做完 commit → 跑 `python tests/test_e2e_flow.py`(5433)。
> 順序 H1 → H2。完成後交回 Claude 複檢。

---

## H1 — 使用者改自己的密碼(/auth/me/password)

```
你是資深 FastAPI 工程師。補一個「登入者改自己密碼」的端點。只改三個檔案,不要重構。

【背景】
Stage G1 的 POST /api/v1/users/{id}/password 刻意擋掉 admin 改自己,但系統沒有別的改密碼
入口,導致使用者(包含 admin)無法改自己的密碼。補一個自助端點,要驗舊密碼。

【修改 1】backend/app/schemas/auth.py — 新增:
    from pydantic import Field

    class PasswordChange(BaseModel):
        old_password: str
        new_password: str = Field(min_length=8)
(若檔案內已有 BaseModel import 就沿用,不要重複 import)

【修改 2】backend/app/api/v1/auth.py — 新增 endpoint:
    from app.core.security import verify_password, hash_password
    from app.schemas.auth import PasswordChange

    @router.post("/me/password")
    def change_my_password(
        payload: PasswordChange,
        current_user_dict: dict = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        user = db.query(User).filter(User.username == current_user_dict["username"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(payload.old_password, user.password_hash):
            raise HTTPException(status_code=400, detail="舊密碼不正確")
        user.password_hash = hash_password(payload.new_password)
        db.commit()
        return {"success": True}
注意:這個 router(auth)沒有掛 router 層認證,端點靠 get_current_user 保護,放在
/login /logout /me 旁邊即可。檔案頂部已有的 import 不要重複加。

【修改 3】backend/tests/test_e2e_flow.py — 在 main() 最後追加(沿用 check() 寫法):
    1. 用 admin token POST /api/v1/users 建 {"username":"e2e-pwc","password":"pwc-start-1","role":"operator"}
       (409 表示前次殘留:改用 PATCH 設 is_active=true,再 POST /users/{id}/password 重設回 "pwc-start-1"。
        取得 user_id 可從 GET /api/v1/users 清單找 username=="e2e-pwc")
    2. 用 e2e-pwc / pwc-start-1 登入 → 200,取得 token
    3. 用該 token POST /api/v1/auth/me/password
       {"old_password":"WRONG","new_password":"pwc-next-22"} → 400
    4. {"old_password":"pwc-start-1","new_password":"pwc-next-22"} → 200
    5. 用 pwc-next-22 登入 → 200;用 pwc-start-1 登入 → 401
    6. 最後把密碼改回去(用新 token 再呼叫一次 /me/password 換回 "pwc-start-1"),
       讓測試可重複執行
    ⚠️ 這段所有 client 呼叫都要明確帶 headers(admin 的或 e2e-pwc 的),
    不要污染 client.headers 全域狀態(main() 前段已設 admin 的 Authorization)。

【驗收】
1. cd backend && python tests/test_e2e_flow.py 全部 PASS(含新段落,且重跑第二次也要全 PASS)
2. 回應不可出現 password_hash
3. 只 diff 到這三個檔案
```

---

## H2 — 追溯結果補 poNumber / shipDate

```
你是資深 Python 工程師。修補追溯查詢的兩個空欄位。只改 backend/app/core/traceability/tracer.py
與 backend/tests/test_e2e_flow.py,不要重構。

【背景】
GET /api/v1/trace/forward 回應裡 supplier.poNumber 與 shipments[].shipDate 一直是空字串。
資料其實都在 inventory_transactions:
- 收貨時寫了 transaction_type='RECEIVE'、reference_type='PO'、reference_number=採購單號
- 出貨時寫了 transaction_type='SHIP'、reference_type='SO'、reference_number=銷售單號,
  executed_at(或 created_at)是出貨時間

【修改】backend/app/core/traceability/tracer.py 的 trace_forward():
1. poNumber:查這個 lot 的 RECEIVE 交易,取 reference_number:
       receive_txn = (
           self.db.query(InventoryTransaction)
           .filter(
               InventoryTransaction.lot_id == lot.lot_id,
               InventoryTransaction.transaction_type == 'RECEIVE',
               InventoryTransaction.reference_type == 'PO',
           )
           .order_by(InventoryTransaction.transaction_id)
           .first()
       )
   supplier_info["poNumber"] = receive_txn.reference_number if receive_txn else ''
2. shipDate:函式裡已經有 ship_txns 清單。組 shipments 時,對每個 so_num 取該 SO 的
   SHIP 交易(transaction_type=='SHIP' 且 reference_number==so_num)中最早一筆的時間:
       ts = txn.executed_at or txn.created_at
       "shipDate": ts.isoformat()[:10] if ts else ''
   注意 ship_txns 目前混了 SHIP 和 PICK 兩種,取 shipDate 只能用 SHIP 那些。
   (如果 InventoryTransaction model 沒有 executed_at 欄位,就只用 created_at,先打開
   backend/app/models/transaction.py 確認欄位名再寫。)

【修改】backend/tests/test_e2e_flow.py — 找到既有的 trace forward 檢查(supplier name 那段),
在它旁邊加兩個 check:
    check("trace supplier.poNumber == seeded PO", body["supplier"]["poNumber"] == po_number, ...)
    check("trace shipments[0].shipDate non-empty",
          bool(body["shipments"]) and bool(body["shipments"][0]["shipDate"]), ...)
(trace 是在出貨完成後呼叫的,shipments 應該至少一筆。)

【驗收】
1. cd backend && python tests/test_e2e_flow.py 全部 PASS(含兩個新 check)
2. 只 diff 到這兩個檔案
```

---

## 完成後回報清單(貼回給 Claude)

- [ ] H1、H2 commit hash
- [ ] `python tests/test_e2e_flow.py` 輸出(連跑兩次,都要全 PASS)
- [ ] 有偏離 prompt 的地方請列出
