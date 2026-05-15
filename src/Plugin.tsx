import React from 'react';
import { useState, useEffect } from 'react'
import { Button, Input, Radio } from '@dhis2/ui';
import { IFormFieldPluginProps } from './Plugin.types';
//import { Config } from 'tailwindcss';
//import { useSetOnlineStatusMessage } from '@dhis2/app-runtime';

const Plugin = ({
    values,
    fieldsMetadata,
    setFieldValue
}: IFormFieldPluginProps) => {

    // Identifier systems
    interface Identifier {
        "label": string
        "system": string
        "baseUrl": string
        "routeId": string
        "authHeader": string
        "contentType": string
        "queryString": string
    }

    // Datastore config
    interface Config {
        identifiers: Record<string, Identifier>
        healthIdSystemKey:string
    }

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

    const [config, setConfig] = useState<Config | null>(null)
    const [basePath, setBasePath] = useState<string>('')
    const [enteredId, setEnteredId] = useState("");
    const [idType, setIdType] = useState<string>('')
    const [message, setMessage] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    
    useEffect(() => {
        const pathname = window.location.pathname
        let base = '/' + pathname.split('/').filter(Boolean)[0]
        if (base === '/api') base = ''
        
        setBasePath(base)

        const fetchConfig = async () => {
            try {
                setLoading(true)
                const response = await fetch(`${base}/api/dataStore/healthidconnect/config`)
                const data = await response.json()

                setConfig(data)

                const healthidKey = data.healthIdSystemKey || null

                if (!healthidKey) {
                    setError('Health ID system is not configured...')
                }
            } catch (err) {
                setError('Failed to fetch config...')
            } finally {
                setLoading(false)
            }
        }

        fetchConfig()
    }, [])

    const convertToFHIRBundle = (
        data: Record<string, any>,
        fhirMap: Record<string, string>,
        identifierSystem: string
    ): any => {

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

    const fetchExternalData = async () => {
        var response:Record<string, any> = {}
        
        if(config.identifiers[idType].routeId){
            // DHIS2 routes api - priority 1
            const fetchUrl = `${basePath}/api/routes/${config.identifiers[idType].routeId}/run?${config.identifiers[idType].queryString}`
                .replaceAll("{system}", config.identifiers[idType].system)
                .replaceAll("{id}", enteredId)
            response = await fetch(fetchUrl)
        }else if(config.identifiers[idType].baseUrl){
            // baseUrl from config - priority 2
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': config.identifiers[idType].authHeader
            }
            const fetchUrl = `${config.identifiers[idType].baseUrl}?${config.identifiers[idType].queryString}`
                .replaceAll("{system}", config.identifiers[idType].system)
                .replaceAll("{id}", enteredId)
            response = await fetch(fetchUrl, { headers })
        }else{
            setMessage("Either routesId or fhirBaseUrl should exist.")
        }
        
        const data = await response.json()    
        return data
    }

    const fetchAndPopulate = async () => {
        if (!idType) {
            setMessage('Please select ID type.')
            return
        }

        if (!enteredId) {
            setMessage('Please enter a valid ID number of selected type.')
            return
        }
        
        setMessage('Working...')

        const rawData = await fetchExternalData()

        var bundle: any

        if (rawData.resourceType === 'Bundle') {
            // Already FHIR — use directly
            bundle = rawData
        } else {
            // Non-FHIR — convert first
            let selectedConfig:Record<any,any> = config.identifiers[idType]
            let fhirMap = selectedConfig['fhirMap']
            const identifierSystem = selectedConfig.system

            bundle = convertToFHIRBundle(
                rawData,
                fhirMap,
                identifierSystem
            )
        }
        console.log(bundle)

        const person = extractPersonFromFHIR(bundle)
        
        if(!person){
            setMessage("No match found")
            clearFields()
        }else{
            setMessage("Match found, data loaded...")
            const healthIdSystemFromConfig = config.identifiers[config.healthIdSystemKey].system
            setFieldValue({
                fieldId: 'healthId',
                value: person.identifiers[healthIdSystemFromConfig]
            });

            setFieldValue({
                fieldId: 'firstName',
                value: person.firstName.split(" ")[0]
            });

            setFieldValue({
                fieldId: 'middleName',
                value: person.firstName.split(" ")[1]
            });

            setFieldValue({
                fieldId: 'lastName',
                value: person.lastName
            });

            setFieldValue({
                fieldId: 'birthDate',
                value: {date: person.birthDate}
            });

            setFieldValue({
                fieldId: 'gender',
                value: person.gender
            });

            setFieldValue({
                fieldId: 'address',
                value: person.address
            });

            setFieldValue({
                fieldId: 'phone',
                value: person.phone
            });

            setFieldValue({
                fieldId: 'email',
                value: person.email
            });
        }

        setTimeout(() => {
            setMessage('')
        }, 5000)
    };

    const extractPersonFromFHIR = (bundle: FHIRBundle): PersonAttributes | null => {
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

    const clearFields = () => {
        setFieldValue({ fieldId: "firstName", value: "" });
        setFieldValue({ fieldId: "middleName", value: "" });
        setFieldValue({ fieldId: "lastName", value: "" });
        setFieldValue({ fieldId: "birthDate", value: "" });
        setFieldValue({ fieldId: "gender", value: "" });
        setFieldValue({ fieldId: "address", value: "" });
        setFieldValue({ fieldId: "phone", value: "" });
        setFieldValue({ fieldId: "email", value: "" });
    };

    if (loading) return <span style={{color:'#ccc', margin:'15px'}}>Loading...</span>
    if (error) return <span style={{color:'red', margin:'15px'}}>{error}</span>

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'15px',border:'2px solid #c5ec9e',background:'#efe',margin:'0 5px',borderRadius:'10px'  }}>
            <div style={{ display:'flex', flexDirection:'row', gap:'8px' }}>
                Search for health ID with available ID numbers below.
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '16px' }}>
                {config && Object.entries(config.identifiers).map(([key, identifier]) => (
                    <React.Fragment key={key}>
                        <Radio label={identifier.label} value={key} name={key} checked={idType === key}
                            onChange={({ value }) => setIdType(value)}
                        />
                    </React.Fragment>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    <Input type="text" placeholder="Enter ID" value={enteredId}
                        onChange={({ value }) => setEnteredId(value)}
                    />
                    <Button onClick={fetchAndPopulate}> खोज्नुहोस </Button>
            </div>
            <div style={{ display:'flex', flexDirection:'row', gap:'8px' }}>
                {message}
            </div>
        </div>
    )
}

export default Plugin