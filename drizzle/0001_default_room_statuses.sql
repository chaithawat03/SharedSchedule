INSERT INTO "status_master" ("room_id", "code", "name", "sort_order")
SELECT r."id", defaults."code", defaults."code", defaults."sort_order"
FROM "rooms" AS r
CROSS JOIN (VALUES
  ('WORK', 0),
  ('OT', 1),
  ('OFF', 2),
  ('LEAVE', 3),
  ('WFH', 4),
  ('TRAVEL', 5),
  ('PERSONAL', 6),
  ('ACTIVITY', 7),
  ('OTHER', 8)
) AS defaults("code", "sort_order")
WHERE true
ON CONFLICT ("room_id", "code") DO NOTHING;
