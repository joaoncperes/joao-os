-- =============================================================
-- 066_project_completed_at.sql
-- Timestamp de quando um projeto (folder com para_category='projects') foi
-- concluído. Null = não concluído.
--
-- Concluir um projeto seta status='completed', completed_at=now() e move o
-- folder para para_category='archive' (o Archive global do PARA). O status
-- persiste na row mesmo no Archive, então a listagem do Archive consegue
-- filtrar "projetos concluídos" (status='completed') e ordenar por completed_at.
-- =============================================================

alter table folders
  add column if not exists completed_at timestamptz;
