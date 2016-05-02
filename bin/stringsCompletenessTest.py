#!/usr/bin/python

##
# This script is designed to validate string usage code completeness in the l10n property files and for
# the standalone loop client and loop add-on executable code.
# The loop repo is assumed to be https://github.com/mozilla/loop.
#
# Run this script from the local version of loop. It assumes that a local
# version is in directory: ./loop/bin.
##

# TODO - find all missing strings task and print out line
# further searches and tests for larger insight into string use cases and actual unused strings
# gather other useful information
# get list of = "literal strings in the code";
# Iterate back over code with patterns from not found
# or unused strings to find literal strings used and where (line).
##

from __future__ import print_function

import argparse
import io
import os
import itertools as it
import glob
import re

# defaults
DEF_PROPERTY_LOCALE = "en-US"


def main(l10n_locale):
    # capture root path assuming this file is in loop/bin
    # uncomment the next line if you are not running this from Makefile strings call
    # os.chdir(os.path.abspath(os.pardir))
    loop_root_dir = os.getcwd()
    def_property_dirs = ["add-on", "shared", "standalone"]
    # loop/locale/en-US
    def_us_locale_dir = os.path.abspath(os.path.join(loop_root_dir, "locale", l10n_locale))
    def_property_addon_file_name = os.path.join(def_us_locale_dir, os.extsep.join([def_property_dirs[0], "properties"]))
    def_property_shared_file_name = os.path.join(
        def_us_locale_dir, os.extsep.join([def_property_dirs[1], "properties"]))
    def_property_standalone_name = os.path.join(def_us_locale_dir, os.extsep.join([def_property_dirs[2], "properties"]))

    # print("l10n_locale", l10n_locale)
    # print(def_us_locale_dir)
    # print(def_property_addon_file_name)
    # print(def_property_shared_file_name)
    # print(def_property_standalone_name)

    # START
    l10n_properties = {}
    l10n_files = [def_property_addon_file_name, def_property_shared_file_name, def_property_standalone_name]

    read_strings_from_l10n(l10n_properties, l10n_files)

    not_found_string_list = {}
    props_found = check_strings_in_code(l10n_properties, loop_root_dir, not_found_string_list)

    if report_result(l10n_properties, props_found, not_found_string_list) > 0:
        exit(1)
    else:
        exit(0)


# def read_strings_from_l10n(**kwargs):
def read_strings_from_l10n(l10n_properties, l10n_files, **arglist):
    # print("l10n_properties", l10n_properties)
    # print("l10n_files", l10n_files)
    # We use encoding="UTF-8" so that we have a known consistent encoding format.
    # Sometimes the locale isn't always defined correctly for python, so we try
    # to handle that here.
    string_match_pattern = re.compile(r"^([a-z0-9_]*)=")
    for prop_file in l10n_files:
        # print("reading locale addon properties in", prop_file)
        with io.open(prop_file, "r", encoding="UTF-8") as property_file:
            for line in property_file:  # process line by line
                for match in re.finditer(string_match_pattern, line):
                    property_key = match.group(1).encode("utf-8")
                    # print(property_key)
                    l10n_properties[property_key] = 0
                    # print(l10n_properties[property_key])


def check_strings_in_code(l10n_properties, loop_root_dir, not_found_string_list, **list):
    props_found = 0

    # directories to look in
    def_code_dirs = ["add-on/chrome", "add-on/panels/js", "add-on/panels/vendor", "shared/js", "standalone/content/js"]
    # regex string getter methods to look for
    string_match_pattern = re.compile(r"""
        _getString\(\"(.*)\"\)
        |
        mozL10n\.get\(\"(.*)\"
        |
        \"([a-z0-9_]*)\"
    """, re.VERBOSE)

    # iterate search through files in code directories
    for code_dir in def_code_dirs:
        os.chdir(loop_root_dir)
        # print("Current directory: ", os.getcwd())
        # print("code_dir", code_dir)
        os.chdir(code_dir)
        # print("Current directory: ", os.getcwd())
        for fname in multiple_file_types("*.js", "*.jsx", "*.jsm"):
            file_path = os.path.join(os.getcwd(), fname)
            with io.open(file_path, "r", encoding="UTF-8") as code_file:
                for line in code_file:  # process line by line
                    for match in re.finditer(string_match_pattern, line):
                        # print(string_match_pattern)
                        # print(line,)
                        # print('Group 1: %s' % (match.group(1)))
                        # print('Group 2: %s' % (match.group(2)))
                        # print('Group 3: %s' % (match.group(3)))
                        if match.group(1):
                            code_key = match.group(1).encode("utf-8")
                            # print("code_key", code_key)
                            if code_key in l10n_properties:
                                # print("FOUND GROUP1: ", code_key)
                                l10n_properties[code_key] = 1
                                props_found += 1
                                # print(l10n_properties[code_key])
                            else:
                                # strings in code not found in properties list - what are they?
                                if not_found_string_list.get(code_key):
                                    not_found_string_list[code_key] = not_found_string_list.get(code_key) + 1
                                else:
                                    not_found_string_list[code_key] = 1
                        elif match.group(2):
                            code_key = match.group(2).encode("utf-8")
                            # print("code_key", code_key)
                            if code_key in l10n_properties:
                                # print("FOUND GROUP2: ", code_key)
                                l10n_properties[code_key] = 1
                                props_found += 1
                                # print(l10n_properties[code_key])
                            else:
                                # strings in code not found in properties list - what are they?
                                if not_found_string_list.get(code_key):
                                    not_found_string_list[code_key] = not_found_string_list.get(code_key) + 1
                                else:
                                    not_found_string_list[code_key] = 1
                        elif match.group(3):
                            code_key = match.group(3).encode("utf-8")
                            # print("code_key", code_key)
                            if code_key in l10n_properties:
                                # print("FOUND GROUP3: ", code_key)
                                # print(line)
                                l10n_properties[code_key] = 1
                                props_found += 1
                                # print(l10n_properties[code_key])
                            else:
                                # strings in code not found in properties list - what are they?
                                if not_found_string_list.get(code_key):
                                    not_found_string_list[code_key] = not_found_string_list.get(code_key) + 1
                                else:
                                    not_found_string_list[code_key] = 1
    return props_found


def report_result(l10n_properties, props_found, not_found_string_list, **arglist):
    props_count = len(l10n_properties)
    props_not_used = props_count - props_found

    print("Code strings not found in properties files with hit-count:")
    for prop2 in not_found_string_list:
        print(prop2, not_found_string_list.get(prop2))

    print("=====================")
    if props_not_used > 0:
        print("Properties not found in code:")
        for prop in l10n_properties:
            if l10n_properties.get(prop) == 0:
                print(prop)

        print("=====================")
        print("props_not_used", props_not_used)
    # print("props_count", props_count)
    # print("props_found", props_found)
    # props_found_perc = (float(props_found) / props_count) * 100
    # print("props_found_perc %{0:.2f}".format(props_found_perc))
    return props_not_used
    # END


def multiple_file_types(*patterns):
    return it.chain.from_iterable(glob.glob(pattern) for pattern in patterns)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Loop localization string property completeness test script")
    parser.add_argument('--locale',
                        default=DEF_PROPERTY_LOCALE,
                        metavar="path",
                        help="l10n locale directory used to test completeness against. \
                        Default = " + DEF_PROPERTY_LOCALE)
    args = parser.parse_args()
    main(args.locale)
