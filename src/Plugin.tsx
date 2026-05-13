import React from 'react';
import { useState, useEffect } from 'react'
import { Button, Input, Radio } from '@dhis2/ui';
import { IFormFieldPluginProps } from './Plugin.types';
import { Config } from 'tailwindcss';
import { useSetOnlineStatusMessage } from '@dhis2/app-runtime';

const Plugin = ({
    values,
    fieldsMetadata,
    setFieldValue
}: IFormFieldPluginProps) => {
    // Identifier systems
    interface Identifier {
        label: string
        system: string
    }

    // Datastore config
    interface Config {
        routeId: string
        customUrl?:{
            authHeader:string
            fhirBaseUrl:string
        }
        identifiers: Record<string, Identifier>
        healthIdSystem:string
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
    //const [fhirBaseUrl, setFhirBaseUrl] = useState<string>(null)
    
    const [enteredId, setEnteredId] = useState("");
    const [idType, setIdType] = useState<string>('')
    const [message, setMessage] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                setLoading(true)
                const response = await fetch('/ephc/api/dataStore/healthidconnect/config')
                const data = await response.json()
                setConfig(data)
            } catch (err) {
                setError('Failed to fetch configs')
            } finally {
                setLoading(false)
            }
        }
        fetchConfig()
    }, [])

    const fetchExternalData = async () => {
        var response:Record<string, any> = {}

        if(config.routeId){
            // DHIS2 routes api - priority 1
            response = await fetch(`/ephc/api/routes/${config.routeId}/run?identifier=${config.identifiers[idType].system}|${enteredId}`)
        }else if(config.customUrl){
            // URL from datastore - priority 2
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': config.customUrl.authHeader
            }

            response = await fetch(
                `${config.customUrl.fhirBaseUrl}?identifier=${config.identifiers[idType].system}|${enteredId}`,
                { headers }
            )
        }else{
            setMessage("Either routesId or fhirBaseUrl should exist.")
        }
        
        const data = await response.json()
        return data
    }

    const fetchAndPopulate = async () => {
        setMessage("Working...")
        
        const bundle = await fetchExternalData()
        const person = extractPersonFromFHIR(bundle)

        if(bundle.total == 0){
            setMessage("No match found")
            clearFields()
        }else{
            console.log(person)
            setMessage("Match found, data loaded...")

            const healthidKey = config.healthIdSystem

            setFieldValue({
                fieldId: 'nationalId',
                value: person.identifiers[healthidKey]
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
        const name =
            person.name?.find((n) => n.use === 'official') ?? person.name?.[0]

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
        ]
            .filter(Boolean)
            .join(', ')

        // Extract all identifiers as a map of system -> value
        const identifiers = (person.identifier ?? []).reduce<Record<string, string>>(
            (acc, id) => {
                if (id.system && id.value) acc[id.system] = id.value
                return acc
            },
            {}
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

    /*const assignAge = (birthDate: string) => {
        const birth = new Date(birthDate)
        const today = new Date()

        // Calculate differences
        let years = today.getFullYear() - birth.getFullYear()
        let months = today.getMonth() - birth.getMonth()
        let days = today.getDate() - birth.getDate()

        // Adjust if days is negative
        if (days < 0) {
            months--
            days += new Date(today.getFullYear(), today.getMonth(), 0).getDate()
        }

        // Adjust if months is negative
        if (months < 0) {
            years--
            months += 12
        }

        return { birthDate, years, months, days }
    }*/

    const clearFields = () => {
        setFieldValue({ fieldId: "firstName", value: null });
        setFieldValue({ fieldId: "middleName", value: "" });
        setFieldValue({ fieldId: "lastName", value: "" });
        setFieldValue({ fieldId: "birthDate", value: "" });
        setFieldValue({ fieldId: "gender", value: "" });
        setFieldValue({ fieldId: "address", value: "" });
        setFieldValue({ fieldId: "phone", value: "" });
        setFieldValue({ fieldId: "email", value: "" });
    };

    if (loading) return <span>Loading...</span>
    if (error) return <span>{error}</span>

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