import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState icon={<FileQuestion />} title="Page not found" action={<Button variant="outline" asChild><Link to="/">Go to dashboard</Link></Button>}>
      That page doesn’t exist.
    </EmptyState>
  )
}
