
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public read product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Admins upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
