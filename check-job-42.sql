SELECT 
  s.id as signer_id,
  s.job_id,
  s.signer_name,
  s.signer_email,
  u.role as user_role,
  jp.job_specific_role,
  CASE 
    WHEN jp.id IS NOT NULL THEN 'Has explicit jobParticipants entry'
    ELSE 'No explicit entry (incorrectly added)'
  END as status
FROM signers s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN job_participants jp ON (
  jp.job_id = s.job_id 
  AND jp.user_id = s.user_id 
  AND jp.job_specific_role IN ('signer', 'witness')
)
WHERE s.job_id = 42
ORDER BY s.id;
