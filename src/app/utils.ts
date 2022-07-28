import * as merger from "./interfaces";
import express from "express";

export const createMergerError = (message: string, status?: number, stacktrace?: string): merger.Error => {
	return { status, message, stacktrace }
}

export const testEmail = (email?: string) => {
	if (!email) return false

	return new RegExp(/^([A-z\d_\-.]+)@([A-z\d_\-.]+)\.([A-z]{2,5})$/g).test(email)
}

export const testUsername = (username: string) => {
	return new RegExp(/^([A-z\d\-&.#\[\]]+)$/g).test(username)
}

export const testPassword = (password?: string): boolean => {
	if (!password) return false

	return new RegExp(/^([A-z\d\-&.#[]]+)$/g).test(password)
}

export const isUserAuthenticated = (session: any): boolean => {
	return session.authenticated && session.userId 
}
	
export const isSpotifyTrackObject = (obj: any): obj is SpotifyApi.TrackObjectSimplified => {
   return (obj as SpotifyApi.TrackObjectSimplified).type === "track";
}
