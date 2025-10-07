INSERT OR IGNORE INTO operators (id,name,teamlead,role,status,statusSince,shift,workHours,images)
VALUES
('u001','Администратор','TL 1','admin','Чаты','', '5/2','09:00–18:00','[]'),
('u002','Оператор Пример','TL 1','','Чаты','', '2/2','08:00–20:00','[]');

INSERT OR IGNORE INTO accessCodes (code,displayName,operatorId,role)
VALUES
('123456','Администратор','u001','admin'),
('654321','Оператор Пример','u002','');
