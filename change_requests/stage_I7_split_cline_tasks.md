# Stage I7(拆小版)— 角色感知 UI + 使用者管理 + 改密碼

> 產生時間:2026-06-12。I7 原本是一個大任務,因 local model 改大檔案容易截斷,拆成五個
> 單檔小任務。**一個任務一個新 Cline session,嚴格按 a→b→c→d→e 順序**。
>
> ⚠️ 每個任務共同規則(每段 prompt 都要遵守):
> 1. 修改既有檔案一律用 replace_in_file 做小範圍替換,**禁止用 write_to_file 重寫整個既有檔案**
> 2. 若發現必須重寫整檔才能完成,立刻停止並回報,不要硬做
> 3. 做完跑 `cd frontend && npx tsc --noEmit`,有錯就修到綠
> 4. 只 diff 到任務指定的檔案

---

## I7a — auth.ts:登入後取得並保存角色

```
你是前端工程師。只改 frontend/src/app/api/auth.ts,小範圍修改,禁止重寫整檔。

【背景】
- GET /api/v1/auth/me 回 {user_id, username, full_name, role}
- 檔案裡已有 fetchCurrentUser()(會把結果存進模組變數 currentUser)與 getCurrentUser()
- 問題:login() 成功後只存了 {username},沒有 role → UI 無法做角色判斷

【修改】
1. login():登入成功、設定完 token 與 axios header 之後,改成呼叫既有的
   fetchCurrentUser() 來填 currentUser(取代現在手寫 currentUser = { username })。
2. 新增一個便利函式並 export:
       export function getRole(): string {
         return currentUser?.role ?? '';
       }

【驗收】npx tsc --noEmit 無錯誤;npm test 全綠(auth.test.ts 若有「login 後 username」
相關斷言失敗,把該測試的 axios.get mock 補上 /auth/me 的回傳即可,不要改 auth.ts 邏輯)
```

---

## I7b — 新增 UserAdminModule.tsx(全新檔案)

```
你是前端工程師。只「新增」一個檔案 frontend/src/app/components/UserAdminModule.tsx,
不要動任何其他檔案(App.tsx 的掛載是下一個任務)。

【後端 API(都已存在,全部限 admin,非 admin 回 403)】
- GET    /api/v1/users                    → [{user_id, username, full_name, role, is_active}]
- POST   /api/v1/users                    → {username, password(≥8), role, full_name?} → 201
                                            409=帳號重複、400=角色不合法
- PATCH  /api/v1/users/{user_id}          → {role? | full_name? | is_active?} → 200
                                            自己停用自己/改掉自己的 admin → 400
- POST   /api/v1/users/{user_id}/password → {new_password(≥8)} → {"success": true}
                                            改自己的密碼會回 400(設計如此)
角色固定:admin / qc / supervisor / operator(中文:管理員/品管/主管/作業員)

【元件需求】
- export default function UserAdminModule()
- 載入時 GET /api/v1/users 顯示表格:帳號 / 姓名 / 角色(下拉,改了直接 PATCH)/
  狀態(啟用/停用 toggle 按鈕,直接 PATCH is_active)/ 操作(重設密碼按鈕)
- 「新增使用者」按鈕 → dialog(帳號、密碼、角色下拉、姓名選填)→ POST;
  409/400 顯示後端 detail;成功關 dialog 並刷新表格
- 「重設密碼」→ dialog(新密碼,前端先驗 ≥8)→ POST /{id}/password
- 自己那一列(用 ../api/auth 的 getCurrentUser()?.username 比對):
  角色下拉與停用 toggle 設 disabled,重設密碼按鈕不顯示
- 錯誤處理:任何請求失敗顯示 err.response?.data?.detail
- 樣式比照其他模組(Tailwind、bg-white rounded-lg border 卡片、
  dialog 用 fixed inset-0 bg-black/50 那套,可參考 InventoryModule 的批次詳情 dialog)
- 只用既有依賴:react、axios、lucide-react

【驗收】npx tsc --noEmit 無錯誤(檔案還沒被引用,不會出現在畫面,正常)
```

---

## I7c — App.tsx:掛使用者管理分頁 + 角色顯示

```
你是前端工程師。只改 frontend/src/app/App.tsx,小範圍 replace,禁止重寫整檔。

【修改 1】import UserAdminModule from './components/UserAdminModule';
【修改 2】從 './api/auth' 的 import 加上 getRole(該函式 I7a 已加)。
【修改 3】TabsList 裡比照其他 TabsTrigger,加一個 value="users" 的分頁「使用者管理」,
    但只在 getRole() === 'admin' 時渲染(用 {getRole() === 'admin' && (...)})。
    對應的 <TabsContent value="users"><UserAdminModule /></TabsContent> 同樣條件渲染,
    放在其他 TabsContent 旁邊。
【修改 4】header 的「操作員: {username}」加上角色中文標籤:
    const roleLabel = {admin:'管理員', qc:'品管', supervisor:'主管', operator:'作業員'}[getRole()] ?? '';
    顯示成「操作員: {username}{roleLabel ? `(${roleLabel})` : ''}」
    (roleLabel 的常數放在元件外層即可)

【驗收】npx tsc --noEmit;npm test 全綠;手動:admin 登入看得到「使用者管理」分頁,
operator 登入看不到;header 顯示角色
```

---

## I7d — 新增 ChangePasswordDialog.tsx + App.tsx 一行掛載

```
你是前端工程師。新增 frontend/src/app/components/ChangePasswordDialog.tsx,
並在 App.tsx 做最小掛載(兩處小 replace)。

【後端 API(已存在)】
POST /api/v1/auth/me/password  body {old_password, new_password(≥8)}
- 成功回 {access_token, token_type}(⚠️ 會換發新 token!)
- 舊密碼錯 → 400 {"detail": "Incorrect old password"}

【新檔案 ChangePasswordDialog.tsx】
- props: {open: boolean; onClose: () => void}
- 欄位:舊密碼 / 新密碼 / 確認新密碼(都是 type="password")
- 前端驗證:新密碼 ≥8;兩次新密碼一致,不過就地顯示錯誤不送出
- 送出成功後:把回傳的 access_token 存回 localStorage('wms_token') 並更新
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  (這樣不用重新登入),顯示「密碼已更新」後 1 秒自動 onClose
- 400 顯示「舊密碼不正確」;其他錯誤顯示 detail
- dialog 樣式比照專案其他 dialog

【App.tsx 兩處小 replace】
1. import ChangePasswordDialog + useState 一個 showPwDialog
2. header 登出按鈕旁加「改密碼」按鈕(樣式比照登出鈕,icon 用 KeyRound)
   → setShowPwDialog(true);在 JSX 底部掛 <ChangePasswordDialog open={showPwDialog}
   onClose={() => setShowPwDialog(false)} />

【驗收】npx tsc --noEmit;手動:改密碼 → 不重新登入直接操作其他模組仍正常(token 已換新)
→ 登出後用新密碼登入成功
```

---

## I7e — 模組內角色閘門(兩個小 replace)

```
你是前端工程師。兩個檔案各做一處小 replace,禁止重寫整檔。
角色取得方式:import { getRole } from '../api/auth';

【ReceivingModule.tsx】
找到 IQC 表單區塊(「完成 IQC」按鈕所在的那段)。在它外層加條件:
    {['admin','qc'].includes(getRole()) ? ( ...原本的 IQC 區塊... ) : (
      <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
        IQC 檢驗需要品管(qc)或管理員權限
      </p>
    )}
只包 IQC 表單,不要動掃描/收貨/列印標籤的部分。

【InventoryModule.tsx】
找到批次詳情 dialog 裡「調整 / 拆帶(後端限 supervisor/admin)」那段
(註解是 {/* 調整 / 拆帶(後端限 supervisor/admin)*/})。在它外層加條件:
    {['admin','supervisor'].includes(getRole()) && ( ...原本整段... )}
不顯示替代文字,直接隱藏。

【驗收】npx tsc --noEmit;npm test;手動:operator 登入 → 收貨頁 IQC 區顯示權限提示、
庫存詳情看不到調整/拆帶;admin 登入兩者都正常
```

---

## 完成後回報清單(貼回給 Claude)

- [ ] I7a–I7e 各自 commit hash(一任務一 commit,失敗的任務直接回報不要硬修)
- [ ] `npx tsc --noEmit`、`npm test` 結果
- [ ] 有偏離 prompt 的地方請列出
