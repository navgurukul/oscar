export type DocumentSourceKind = "upload" | "url" | "paste";

export interface OrgDocument {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  title: string;
  source_kind: DocumentSourceKind;
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  extracted_text: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface OrgDocumentWithDownload extends OrgDocument {
  download_url: string | null;
}
