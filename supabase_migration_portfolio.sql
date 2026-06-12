-- ═══════════════════════════════════════════════════════════════
-- 持股帳冊綁定使用者 + 啟用資料列安全性（RLS）
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run
--
-- ⚠️ 注意：執行前請確認 GitHub Secrets 裡的 SUPABASE_KEY 是
--    service_role key（不是 anon key），否則掃描程式會讀不到持股。
--    確認方式：Supabase Dashboard → Settings → API → service_role
-- ═══════════════════════════════════════════════════════════════

-- 1. 加上 user_id 欄位
alter table public.portfolio
  add column if not exists user_id uuid references auth.users(id);

-- 2. 把現有的持股全部歸給主帳號（denmark1125@gmail.com）
update public.portfolio
set user_id = (select id from auth.users where email = 'denmark1125@gmail.com' limit 1)
where user_id is null;

-- 3. 啟用 RLS：每個人只能看到、操作自己的持股
alter table public.portfolio enable row level security;

drop policy if exists "own portfolio select" on public.portfolio;
create policy "own portfolio select" on public.portfolio
  for select using (auth.uid() = user_id);

drop policy if exists "own portfolio insert" on public.portfolio;
create policy "own portfolio insert" on public.portfolio
  for insert with check (auth.uid() = user_id);

drop policy if exists "own portfolio update" on public.portfolio;
create policy "own portfolio update" on public.portfolio
  for update using (auth.uid() = user_id);

drop policy if exists "own portfolio delete" on public.portfolio;
create policy "own portfolio delete" on public.portfolio
  for delete using (auth.uid() = user_id);

-- service_role（掃描程式）不受 RLS 限制，仍可讀取所有人的持股做停損監控
