"""Verification and detection modules.

Each subpackage owns one document type or one analysis technique, implements
:class:`modules.common.verifier.Verifier`, and returns checks. None of them
decide a verdict; that is the backend's job.
"""
