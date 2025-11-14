import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface TableViewProps {
  data: any
}

export function TableView({ data }: TableViewProps) {
  // Convert data to table format
  const getTableData = () => {
    if (!data) return { headers: [], rows: [] }

    // Handle array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) return { headers: [], rows: [] }
      
      // Get all unique keys from all objects
      const allKeys = new Set<string>()
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => allKeys.add(key))
        }
      })
      
      const headers = Array.from(allKeys)
      const rows = data.map(item => {
        if (typeof item === 'object' && item !== null) {
          return headers.map(header => item[header])
        }
        return [item]
      })
      
      return { headers: headers.length > 0 ? headers : ['Value'], rows }
    }

    // Handle single object - convert to key-value pairs
    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data)
      return {
        headers: ['Key', 'Value'],
        rows: entries.map(([key, value]) => [key, value])
      }
    }

    // Handle primitive values
    return {
      headers: ['Value'],
      rows: [[data]]
    }
  }

  const { headers, rows } = getTableData()

  // Get cell display with proper handling of complex types
  const getCellDisplay = (value: any) => {
    if (value === null) {
      return <span className="text-muted-foreground italic">null</span>
    }
    if (value === undefined) {
      return <span className="text-muted-foreground italic">undefined</span>
    }
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
          {value.toString()}
        </Badge>
      )
    }
    if (typeof value === 'object') {
      return (
        <div className="font-mono text-xs max-w-md overflow-hidden">
          <details className="cursor-pointer">
            <summary className="text-blue-600 hover:text-blue-800">
              {Array.isArray(value) ? `Array[${value.length}]` : 'Object'}
            </summary>
            <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(value, null, 2)}
            </pre>
          </details>
        </div>
      )
    }
    if (typeof value === 'number') {
      return <span className="font-mono text-purple-600">{value}</span>
    }
    
    const strValue = String(value)
    // Check if it's a URL
    if (strValue.match(/^https?:\/\//)) {
      return (
        <a 
          href={strValue} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {strValue}
        </a>
      )
    }
    
    return <span className="break-all">{strValue}</span>
  }

  if (headers.length === 0 || rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No data to display in table format
      </div>
    )
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="min-w-full">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, index) => (
                <TableHead key={index} className="font-semibold bg-muted/50">
                  {String(header)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="align-top">
                    {getCellDisplay(cell)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  )
}
