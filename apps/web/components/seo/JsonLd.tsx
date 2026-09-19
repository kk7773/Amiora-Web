type JsonLdValue = Record<string, unknown>

type JsonLdProps = {
  data: JsonLdValue | JsonLdValue[]
}

/** Renders one or more JSON-LD structured data blocks. */
export function  JsonLd({ data }: JsonLdProps) {
  const graphs = Array.isArray(data) ? data : [data]
  return (
    <>
      {graphs.map((graph, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
      ))}
    </>
  )
}
