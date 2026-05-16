ALTER TABLE public.payments
  ADD CONSTRAINT payments_transaction_id_unique UNIQUE (transaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS commission_payments_transaction_reference_unique
ON public.commission_payments (transaction_reference)
WHERE transaction_reference IS NOT NULL;