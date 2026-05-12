import React from 'react';
import { useState, useEffect } from 'react'
import { Button, Input } from '@dhis2/ui';
import { IFormFieldPluginProps } from './Plugin.types';
import { Config } from 'tailwindcss';

const Plugin = ({
    values,
    fieldsMetadata,
    setFieldValue
}: IFormFieldPluginProps) => {
    
    interface Identifier {
        label: string
        system: string
    }

    interface Config {
        password: string
        username: string
        identifier: string
        fhirBaseUrl: string
        identifiers: Record<string, Identifier>
    }
    const [config, setConfig] = useState<Config | null>(null)
    const [fhirBaseUrl, setFhirBaseUrl] = useState<string>(null)
    
    const [enteredId, setEnteredId] = useState("");
    const [idType, setIdType] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                setLoading(true)
                const response = await fetch('/ephc/api/dataStore/healthidconnect/config')
                const data = await response.json()
                setConfig(data)
                setFhirBaseUrl(data.fhirBaseUrl);
            } catch (err) {
                setError('Failed to fetch configs')
            } finally {
                setLoading(false)
            }
        }
        fetchConfig()
    }, [])

    const fetchExternalData = async () => {
        
        //console.log(config)
        //console.log(config.identifiers[idType].system)
        //console.log(window.location.origin)
        //console.log(window.location.pathname)

        // Test
        //const response = await fetch(`https://randomuser.me/api?inc=gender,name,dob&seed=${enteredId}`)
        
        // Datastore fhirBaseUrl - need to handle authentication
        //const response = await fetch(`${config.fhirBaseUrl}/Patient?identifier=${config.identifiers[idType].system}|${enteredId}`)
        
        // DHIS2 routes api
        const response = await fetch(`/ephc/api/routes/healthid/run?identifier=${config.identifiers[idType].system}|${enteredId}`)
        const data = await response.json()
        return data
    }

    const fetchAndPopulate = async () => {
        setLoading(true)
        
        const data = await fetchExternalData()

        setFieldValue({
            fieldId: 'firstName',
            value: data.results[0].name.first,
        });

        setFieldValue({
            fieldId: 'lastName',
            value: data.results[0].name.last,
        });

        setFieldValue({
            fieldId: 'dob',
            value: data.results[0].dob.date.substring(0,10),
        });

        setLoading(false)
    };

    if (loading) return <span>Loading...</span>
    if (error) return <span>{error}</span>

    return (
        <div style={{ padding: 10, backgroundColor: 'lightblue' }}>
            <h1>Plugin Test</h1>

            <div style={{ padding: 10, border: '1px solid black' }}>
                <pre>
                    {/*JSON.stringify(values, null, 2)*/}
                </pre>
                <div>
                    {config && Object.entries(config.identifiers).map(([key, identifier]) => (
                        <div key={key}>
                            <input
                                type="radio"
                                id={key}
                                value={key}
                                checked={idType === key}
                                onChange={(e) => setIdType(e.target.value)}
                            />
                            <label htmlFor={key}>{identifier.label}</label>
                        </div>
                    ))}
                    <Input
                        type="text"
                        placeholder="Enter ID"
                        value={enteredId}
                        onChange={({ value }) => setEnteredId(value)}
                    />
                </div>
                <Button onClick={fetchAndPopulate}>
                    Search | खोज्नुहोस
                </Button>
            </div>
        </div>
    )
}

export default Plugin