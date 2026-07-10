import { CRM_FIELDS, MAX_UPLOAD_BYTES } from '@groweasy/core'

import { Workspace } from '@/components/Workspace'

// Both cross the server boundary as props so the client bundle never pulls in
// core's parser, phone, and date dependencies.
export default function Home() {
  return <Workspace fields={CRM_FIELDS} maxBytes={MAX_UPLOAD_BYTES} />
}
