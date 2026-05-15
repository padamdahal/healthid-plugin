   
   interface FHIRName {
        use?: string
        family?: string
        given?: string[]
    }

    interface FHIRIdentifier {
        system?: string
        value?: string
    }

    interface FHIRPerson {
        resourceType: string
        id?: string
        name?: FHIRName[]
        identifier?: FHIRIdentifier[]
        birthDate?: string
        gender?: string
        telecom?: { system?: string; value?: string }[]
        address?: { line?: string[]; city?: string; state?: string; postalCode?: string }[]
    }

    interface FHIRBundle {
        resourceType: string
        type: string
        entry?: { resource: FHIRPerson }[]
    }

    interface PersonAttributes {
        id: string
        firstName: string
        lastName: string
        birthDate: string
        gender: string
        phone: string
        email: string
        address: string
        identifiers: Record<string, string>
    }

    export const convertToFHIRBundle = (
        data: Record<string, any>,
        fhirMap: Record<string, string>,
        identifierSystem: string
    ): any | null => {

        // Resolve a value from raw data using JS expression
        const resolve = (expr: string): string => {
            if (!expr) return ''
            try {
                // eslint-disable-next-line no-new-func
                const fn = new Function('data', `try { return data.${expr} } catch(e) { return '' }`)
                const result = fn(data)
                return result !== undefined && result !== null ? String(result) : ''
            } catch {
                return ''
            }
        }

        const firstName = resolve(fhirMap['name.given'])
        const lastName  = resolve(fhirMap['name.family'])
        const gender    = resolve(fhirMap['gender'])
        const birthDate = resolve(fhirMap['birthDate'])

        // Check major fields — at minimum name or birthDate must exist
        if (!firstName && !lastName) {
            console.warn('convertToFHIRPerson: name is empty')
            return null
        }

        if (!gender && !birthDate) {
            console.warn('convertToFHIRPerson: both gender and birthDate are empty')
            return null
        }

        // Build FHIR Person resource
        const person: any = {
            resourceType: 'Person',
            name: [{
                use: 'official',
                given: [resolve(fhirMap['name.given'])],
                family: resolve(fhirMap['name.family'])
            }],
            gender: resolve(fhirMap['gender']),
            birthDate: resolve(fhirMap['birthDate']),
            telecom: [],
            identifier: [],
            address: []
        }

        // Phone
        const phone = resolve(fhirMap['telecom.phone'])
        if (phone) person.telecom.push({ system: 'phone', value: phone })

        // Email
        const email = resolve(fhirMap['telecom.email'])
        if (email) person.telecom.push({ system: 'email', value: email })

        // Identifier
        const idValue = resolve(fhirMap['identifier'])
        if (idValue) person.identifier.push({ system: identifierSystem, value: idValue })

        // Address
        const city   = resolve(fhirMap['address.city'])
        const state  = resolve(fhirMap['address.state'])
        const line   = resolve(fhirMap['address.line'])
        if (city || state || line) {
            person.address.push({
                line: line ? [line] : [],
                city,
                state
            })
        }

        // Wrap in a FHIR Bundle so extractPersonFromFHIR works unchanged
        return {
            resourceType: 'Bundle',
            type: 'searchset',
            total: 1,
            entry: [{ resource: person }]
        }
    }

    
    export const extractPersonFromFHIR = (bundle: FHIRBundle): PersonAttributes | null => {
        // Check if bundle has entries
        if (!bundle.entry || bundle.entry.length === 0) return null

        // Get the first Person resource
        const person = bundle.entry[0].resource

        // Extract name (prefer 'official' use, fallback to first)
        const name = person.name?.find((n) => n.use === 'official') ?? person.name?.[0]

        // Extract telecom
        const phone = person.telecom?.find((t) => t.system === 'phone')?.value ?? ''
        const email = person.telecom?.find((t) => t.system === 'email')?.value ?? ''

        // Extract address
        const addr = person.address?.[0]
        const address = [
            addr?.line?.join(', '),
            addr?.city,
            addr?.state,
            addr?.postalCode,
        ].filter(Boolean).join(', ')

        // Extract all identifiers as a map of system -> value
        const identifiers = (person.identifier ?? []).reduce<Record<string, string>>(
            (acc, id) => {
                if (id.system && id.value) acc[id.system] = id.value
                return acc
            }, {}
        )

        return {
            id: person.id ?? '',
            firstName: name?.given?.join(' ') ?? '',
            lastName: name?.family ?? '',
            birthDate: person.birthDate ?? '',
            gender: person.gender ?? '',
            phone,
            email,
            address,
            identifiers,
        }
    }

    export default {}