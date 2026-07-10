import { CRM_FIELDS } from '@groweasy/core'

import { Workspace } from '@/components/Workspace'

// CRM_FIELDS crosses the server boundary as a prop so the client bundle never
// pulls in core's parser, phone, and date dependencies.
export default function Home() {
  return <Workspace fields={CRM_FIELDS} />
}
